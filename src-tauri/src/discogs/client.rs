//! Discogs HTTP client: authentication, rate limiting, JSON and image downloads.
//!
//! The credential lives only here, in a sensitive header value. It is never placed
//! in a URL, never sent to the image CDN, and never reaches a WebView.

use std::fmt;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, RETRY_AFTER};
use reqwest::{StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::Deserialize;

use crate::media::artwork::detect_artwork_mime;

const API_BASE_URL: &str = "https://api.discogs.com";
const IMAGE_HOST_SUFFIX: &str = ".discogs.com";
const APP_USER_AGENT: &str = concat!(
    "VinylDeck/",
    env!("CARGO_PKG_VERSION"),
    " +https://github.com/ItsRudraksh/vinyldeck"
);
const RATE_LIMIT_REMAINING_HEADER: &str = "x-discogs-ratelimit-remaining";
/// Discogs tracks usage over a moving 60 second window.
const RATE_LIMIT_WINDOW_SECONDS: u64 = 60;
/// Background work stops here, so looking up a new album never finds the budget spent.
const RESERVED_API_REQUESTS: u64 = 15;
const VERSIONS_PER_PAGE: &str = "100";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

pub(crate) enum Credentials {
    Token(String),
    KeySecret { key: String, secret: String },
}

impl Credentials {
    pub(crate) fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Option<Self> {
        let read = |name: &str| lookup(name).filter(|value| !value.trim().is_empty());
        if let Some(token) = read("DISCOGS_TOKEN") {
            return Some(Self::Token(token.trim().to_string()));
        }
        Some(Self::KeySecret {
            key: read("DISCOGS_CONSUMER_KEY")?.trim().to_string(),
            secret: read("DISCOGS_CONSUMER_SECRET")?.trim().to_string(),
        })
    }

    fn header_value(&self) -> Option<HeaderValue> {
        let raw = match self {
            Self::Token(token) => format!("Discogs token={token}"),
            Self::KeySecret { key, secret } => format!("Discogs key={key}, secret={secret}"),
        };
        let mut value = HeaderValue::from_str(&raw).ok()?;
        value.set_sensitive(true);
        Some(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DiscogsError {
    /// Discogs rejected the credential. Retrying cannot help until it changes.
    Unauthorized,
    RateLimited {
        retry_after_seconds: u64,
    },
    Network(String),
    Http(u16),
    InvalidResponse(String),
    InvalidImage,
}

impl fmt::Display for DiscogsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unauthorized => write!(f, "credentials rejected by Discogs"),
            Self::RateLimited {
                retry_after_seconds,
            } => write!(f, "rate limited, retry in {retry_after_seconds}s"),
            Self::Network(message) => write!(f, "network error: {message}"),
            Self::Http(status) => write!(f, "unexpected HTTP status {status}"),
            Self::InvalidResponse(message) => write!(f, "invalid response: {message}"),
            Self::InvalidImage => write!(f, "not a usable image"),
        }
    }
}

// ── Response shapes (only the fields VinylDeck reads) ─────────

#[derive(Debug, Deserialize)]
pub(crate) struct SearchPage {
    #[serde(default)]
    pub(crate) results: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SearchResult {
    pub(crate) id: u64,
    #[serde(default)]
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) format: Vec<String>,
    #[serde(default)]
    pub(crate) label: Vec<String>,
    #[serde(default)]
    pub(crate) year: Option<serde_json::Value>,
    #[serde(default)]
    pub(crate) country: String,
    #[serde(default)]
    pub(crate) catno: String,
    #[serde(default)]
    pub(crate) thumb: String,
    #[serde(default)]
    pub(crate) community: Option<SearchCommunity>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SearchCommunity {
    #[serde(default)]
    pub(crate) have: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ImageDto {
    #[serde(default, rename = "type")]
    pub(crate) kind: String,
    #[serde(default)]
    pub(crate) uri: String,
    #[serde(default)]
    pub(crate) uri150: String,
    #[serde(default)]
    pub(crate) width: u32,
    #[serde(default)]
    pub(crate) height: u32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct MasterDto {
    #[serde(default)]
    pub(crate) images: Vec<ImageDto>,
    #[serde(default)]
    pub(crate) main_release: u64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ReleaseDto {
    #[serde(default)]
    pub(crate) images: Vec<ImageDto>,
    #[serde(default)]
    pub(crate) formats: Vec<ReleaseFormat>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ReleaseFormat {
    /// Free text naming this edition: "Alternate Cover 2", "Glow In The Dark".
    #[serde(default)]
    pub(crate) text: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VersionsPage {
    #[serde(default)]
    pub(crate) versions: Vec<VersionDto>,
    #[serde(default)]
    pub(crate) pagination: Option<Pagination>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Pagination {
    #[serde(default)]
    pub(crate) pages: u32,
    #[serde(default)]
    pub(crate) items: u32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VersionDto {
    pub(crate) id: u64,
    #[serde(default)]
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) catno: String,
    #[serde(default)]
    pub(crate) country: String,
    /// Includes descriptors such as "Unofficial Release".
    #[serde(default)]
    pub(crate) format: String,
    #[serde(default)]
    pub(crate) major_formats: Vec<String>,
    #[serde(default)]
    pub(crate) released: String,
    /// This version's cover at thumbnail size, included without an extra request.
    #[serde(default)]
    pub(crate) thumb: String,
    #[serde(default)]
    pub(crate) stats: Option<VersionStats>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VersionStats {
    #[serde(default)]
    pub(crate) community: Option<VersionCommunity>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VersionCommunity {
    #[serde(default)]
    pub(crate) in_collection: u64,
}

// ── Client ────────────────────────────────────────────────────

pub(crate) struct DiscogsClient {
    http: reqwest::Client,
    base_url: String,
    auth: Option<HeaderValue>,
    cooldown_until: Mutex<Option<Instant>>,
    last_remaining: Mutex<Option<(u64, Instant)>>,
    #[cfg(test)]
    allow_any_image_host: bool,
}

impl DiscogsClient {
    pub(crate) fn new(credentials: Option<&Credentials>) -> Result<Self, DiscogsError> {
        Self::with_base_url(credentials, API_BASE_URL)
    }

    fn with_base_url(
        credentials: Option<&Credentials>,
        base_url: &str,
    ) -> Result<Self, DiscogsError> {
        // Discogs answers 403 to clients that do not identify themselves.
        let http = reqwest::Client::builder()
            .user_agent(APP_USER_AGENT)
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|error| DiscogsError::Network(error.to_string()))?;

        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            auth: credentials.and_then(Credentials::header_value),
            cooldown_until: Mutex::new(None),
            last_remaining: Mutex::new(None),
            #[cfg(test)]
            allow_any_image_host: false,
        })
    }

    #[cfg(test)]
    pub(crate) fn for_test(credentials: Option<&Credentials>, base_url: &str) -> Self {
        let mut client = Self::with_base_url(credentials, base_url).expect("test client");
        client.allow_any_image_host = true;
        client
    }

    pub(crate) async fn search(
        &self,
        kind: &str,
        artist: &str,
        album: &str,
    ) -> Result<Vec<SearchResult>, DiscogsError> {
        let page: SearchPage = self
            .get_json(
                "/database/search",
                &[
                    ("type", kind),
                    ("artist", artist),
                    ("release_title", album),
                    ("per_page", "25"),
                ],
            )
            .await?;
        Ok(page.results)
    }

    pub(crate) async fn master(&self, id: u64) -> Result<MasterDto, DiscogsError> {
        self.get_json(&format!("/masters/{id}"), &[]).await
    }

    pub(crate) async fn versions(&self, id: u64) -> Result<Vec<VersionDto>, DiscogsError> {
        Ok(self.versions_page(id, 1).await?.versions)
    }

    pub(crate) async fn versions_page(
        &self,
        id: u64,
        page: u32,
    ) -> Result<VersionsPage, DiscogsError> {
        self.get_json(
            &format!("/masters/{id}/versions"),
            &[("per_page", VERSIONS_PER_PAGE), ("page", &page.to_string())],
        )
        .await
    }

    pub(crate) async fn release(&self, id: u64) -> Result<ReleaseDto, DiscogsError> {
        self.get_json(&format!("/releases/{id}"), &[]).await
    }

    /// Image URLs are signed CDN links, so no credential is attached.
    pub(crate) async fn download_image(&self, url: &str) -> Result<Vec<u8>, DiscogsError> {
        if !self.is_trusted_image_url(url) {
            return Err(DiscogsError::InvalidImage);
        }

        let response = self
            .http
            .get(url)
            .header(ACCEPT, "image/jpeg, image/png")
            .send()
            .await
            .map_err(|error| DiscogsError::Network(error.without_url().to_string()))?;

        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(DiscogsError::RateLimited {
                retry_after_seconds: retry_after_seconds(response.headers()),
            });
        }
        if !status.is_success() {
            return Err(DiscogsError::Http(status.as_u16()));
        }
        if response
            .content_length()
            .is_some_and(|length| length as usize > MAX_IMAGE_BYTES)
        {
            return Err(DiscogsError::InvalidImage);
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|error| DiscogsError::Network(error.without_url().to_string()))?;
        if bytes.len() > MAX_IMAGE_BYTES || detect_artwork_mime(&bytes).is_none() {
            return Err(DiscogsError::InvalidImage);
        }
        Ok(bytes.to_vec())
    }

    fn is_trusted_image_url(&self, url: &str) -> bool {
        #[cfg(test)]
        if self.allow_any_image_host {
            return true;
        }

        Url::parse(url).is_ok_and(|parsed| {
            parsed.scheme() == "https"
                && parsed
                    .host_str()
                    .is_some_and(|host| host.ends_with(IMAGE_HOST_SUFFIX))
        })
    }

    async fn get_json<T: DeserializeOwned>(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<T, DiscogsError> {
        if let Some(retry_after_seconds) = self.remaining_cooldown_seconds() {
            return Err(DiscogsError::RateLimited {
                retry_after_seconds,
            });
        }

        let mut request = self
            .http
            .get(format!("{}{path}", self.base_url))
            .query(query);
        if let Some(auth) = &self.auth {
            request = request.header(AUTHORIZATION, auth.clone());
        }

        let response = request
            .send()
            .await
            .map_err(|error| DiscogsError::Network(error.without_url().to_string()))?;

        self.note_rate_limit(response.headers());

        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS {
            let retry_after_seconds = retry_after_seconds(response.headers());
            self.start_cooldown(retry_after_seconds);
            return Err(DiscogsError::RateLimited {
                retry_after_seconds,
            });
        }
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            return Err(DiscogsError::Unauthorized);
        }
        if !status.is_success() {
            return Err(DiscogsError::Http(status.as_u16()));
        }

        response
            .json::<T>()
            .await
            .map_err(|error| DiscogsError::InvalidResponse(error.without_url().to_string()))
    }

    /// Whether optional work may spend a request. A reading older than the moving
    /// window says nothing about now, so it no longer holds anything back.
    pub(crate) fn has_spare_requests(&self) -> bool {
        if self.remaining_cooldown_seconds().is_some() {
            return false;
        }
        let Ok(last) = self.last_remaining.lock() else {
            return true;
        };
        last.is_none_or(|(remaining, seen_at)| {
            remaining >= RESERVED_API_REQUESTS
                || seen_at.elapsed() >= Duration::from_secs(RATE_LIMIT_WINDOW_SECONDS)
        })
    }

    /// Throttles locally: once the window is spent, stop before Discogs has to refuse.
    fn note_rate_limit(&self, headers: &HeaderMap) {
        let remaining = headers
            .get(RATE_LIMIT_REMAINING_HEADER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok());
        if let (Some(remaining), Ok(mut last)) = (remaining, self.last_remaining.lock()) {
            *last = Some((remaining, Instant::now()));
        }
        if remaining == Some(0) {
            self.start_cooldown(RATE_LIMIT_WINDOW_SECONDS);
        }
    }

    fn start_cooldown(&self, seconds: u64) {
        if let Ok(mut cooldown) = self.cooldown_until.lock() {
            *cooldown = Some(Instant::now() + Duration::from_secs(seconds));
        }
    }

    fn remaining_cooldown_seconds(&self) -> Option<u64> {
        let until = (*self.cooldown_until.lock().ok()?)?;
        let remaining = until.checked_duration_since(Instant::now())?;
        Some(remaining.as_secs().max(1))
    }
}

fn retry_after_seconds(headers: &HeaderMap) -> u64 {
    headers
        .get(RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|seconds| *seconds > 0)
        .unwrap_or(RATE_LIMIT_WINDOW_SECONDS)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lookup_from(
        pairs: &'static [(&'static str, &'static str)],
    ) -> impl Fn(&str) -> Option<String> {
        move |name| {
            pairs
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.to_string())
        }
    }

    #[test]
    fn credentials_prefer_token_and_require_both_key_and_secret() {
        let token = Credentials::from_lookup(lookup_from(&[
            ("DISCOGS_TOKEN", " abc "),
            ("DISCOGS_CONSUMER_KEY", "k"),
            ("DISCOGS_CONSUMER_SECRET", "s"),
        ]))
        .unwrap();
        assert_eq!(
            token.header_value().unwrap().to_str().unwrap(),
            "Discogs token=abc"
        );

        let pair = Credentials::from_lookup(lookup_from(&[
            ("DISCOGS_CONSUMER_KEY", "k"),
            ("DISCOGS_CONSUMER_SECRET", "s"),
        ]))
        .unwrap();
        assert_eq!(
            pair.header_value().unwrap().to_str().unwrap(),
            "Discogs key=k, secret=s"
        );

        assert!(Credentials::from_lookup(lookup_from(&[("DISCOGS_CONSUMER_KEY", "k")])).is_none());
        assert!(Credentials::from_lookup(lookup_from(&[("DISCOGS_TOKEN", "  ")])).is_none());
    }

    #[test]
    fn credential_header_is_marked_sensitive() {
        let value = Credentials::Token("secret".into()).header_value().unwrap();
        assert!(value.is_sensitive());
        assert!(!format!("{value:?}").contains("secret"));
    }

    #[test]
    fn image_downloads_are_limited_to_discogs_https_hosts() {
        let client = DiscogsClient::new(None).unwrap();
        assert!(client.is_trusted_image_url("https://i.discogs.com/a/b.jpeg"));
        assert!(!client.is_trusted_image_url("http://i.discogs.com/a.jpeg"));
        assert!(!client.is_trusted_image_url("https://i.discogs.com.evil.test/a.jpeg"));
        assert!(!client.is_trusted_image_url("https://evildiscogs.com/a.jpeg"));
        assert!(!client.is_trusted_image_url("file:///C:/secret.jpeg"));
    }
}
