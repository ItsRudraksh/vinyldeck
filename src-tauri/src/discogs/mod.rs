//! Discogs album artwork service. Backend-owned like playback and settings:
//! WebViews ask for an album by artist + title and receive display-ready data URLs.
//! Credentials, HTTP, matching and the disk cache all stay on this side of IPC.

mod cache;
mod client;
mod matching;

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{Mutex as AsyncMutex, Semaphore};

use crate::media::artwork::bytes_to_data_url;
pub use cache::ArtPlacement;
use cache::{AlbumCache, CachedAlbum, CachedEdition, CachedImage, ImageVariant};
use client::{Credentials, DiscogsClient, DiscogsError, ImageDto, SearchResult, VersionDto};
use matching::AlbumLookup;

const ART_CHANGED_EVENT: &str = "discogs-art-changed";
const NETWORK_RETRY_SECONDS: u64 = 60;
const MAX_IMAGES_PER_ALBUM: usize = 36;
const EXTRA_RELEASES_PER_ALBUM: usize = 3;
const MAX_VERSION_COVERS: usize = 24;
const UNOFFICIAL_FORMAT: &str = "Unofficial";
const PRIMARY_KIND: &str = "primary";
const MAX_CONCURRENT_THUMBNAILS: usize = 4;
const MAIN_RELEASE_SOURCE: &str = "Main release";
/// A page holds 100, which covers nearly every album without spending much of the budget.
const MAX_EDITION_PAGES: u32 = 5;
const MAX_CONCURRENT_EDITION_DETAILS: usize = 2;
const VINYL_FORMAT: &str = "Vinyl";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AlbumArtStatus {
    /// Discogs images are available for this album.
    Found,
    /// Searched: no confident match, or a match without images.
    NotFound,
    /// No credentials configured, so Discogs was not contacted.
    Unconfigured,
    /// Discogs could not be reached or refused the request, and nothing is cached.
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumArtImage {
    pub id: String,
    pub kind: String,
    pub width: u32,
    pub height: u32,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumArt {
    pub key: String,
    pub status: AlbumArtStatus,
    pub images: Vec<AlbumArtImage>,
    pub selected_image_id: Option<String>,
    pub artwork_data_url: Option<String>,
    /// How the selected image sits on the record.
    pub placement: ArtPlacement,
    /// The edition the selected image came from, when it came from a specific one.
    pub selected_release_id: Option<u64>,
    pub retry_after_seconds: Option<u64>,
}

impl AlbumArt {
    fn without_images(key: &str, status: AlbumArtStatus, retry_after_seconds: Option<u64>) -> Self {
        Self {
            key: key.to_string(),
            status,
            images: Vec::new(),
            selected_image_id: None,
            artwork_data_url: None,
            placement: ArtPlacement::default(),
            selected_release_id: None,
            retry_after_seconds,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumEdition {
    pub release_id: u64,
    pub title: String,
    pub major_format: String,
    pub format: String,
    pub country: String,
    pub year: String,
    pub label: String,
    pub catno: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumEditions {
    pub editions: Vec<AlbumEdition>,
    pub total_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditionDetails {
    pub name: Option<String>,
    pub images: Vec<AlbumArtImage>,
}

pub struct DiscogsService {
    client: Option<DiscogsClient>,
    cache: AlbumCache,
    album_locks: Mutex<HashMap<String, Arc<AsyncMutex<()>>>>,
    thumbnail_slots: Semaphore,
    edition_detail_slots: Semaphore,
}

impl DiscogsService {
    fn new(client: Option<DiscogsClient>, cache_root: PathBuf) -> Self {
        Self {
            client,
            cache: AlbumCache::new(cache_root),
            album_locks: Mutex::new(HashMap::new()),
            thumbnail_slots: Semaphore::new(MAX_CONCURRENT_THUMBNAILS),
            edition_detail_slots: Semaphore::new(MAX_CONCURRENT_EDITION_DETAILS),
        }
    }

    /// Serializes work per album, so main and mini asking at once (or quick track
    /// skips within an album) produce one search instead of several.
    fn album_lock(&self, key: &str) -> Arc<AsyncMutex<()>> {
        let mut locks = self
            .album_locks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        locks.entry(key.to_string()).or_default().clone()
    }

    pub async fn resolve(&self, artist: &str, album: &str) -> AlbumArt {
        let Some(lookup) = AlbumLookup::new(artist, album) else {
            return AlbumArt::without_images("", AlbumArtStatus::NotFound, None);
        };

        let lock = self.album_lock(&lookup.key);
        let _album_guard = lock.lock().await;

        let cached = self.cache.load(&lookup.key);
        let now = unix_now();
        if let Some(fresh) = cached.as_ref().filter(|entry| entry.is_fresh(now)) {
            return self.present(fresh).await;
        }

        let Some(client) = &self.client else {
            return match &cached {
                Some(stale) => self.present(stale).await,
                None => AlbumArt::without_images(&lookup.key, AlbumArtStatus::Unconfigured, None),
            };
        };

        match fetch_album_images(client, &lookup).await {
            Ok(images) => {
                let refreshed = CachedAlbum::refreshed(cached.as_ref(), &lookup.key, now, images);
                if let Err(error) = self.cache.save(&refreshed) {
                    eprintln!("[VinylDeck discogs] cache write failed: {error}");
                }
                self.present(&refreshed).await
            }
            Err(error) => {
                eprintln!(
                    "[VinylDeck discogs] lookup failed for {}: {error}",
                    lookup.key
                );
                match &cached {
                    // Expired data beats no data while Discogs is unreachable.
                    Some(stale) => self.present(stale).await,
                    None => AlbumArt::without_images(
                        &lookup.key,
                        AlbumArtStatus::Unavailable,
                        retry_hint(&error),
                    ),
                }
            }
        }
    }

    pub async fn select(&self, key: &str, image_id: &str) -> Result<AlbumArt, String> {
        let lock = self.album_lock(key);
        let _album_guard = lock.lock().await;

        let mut album = self
            .cache
            .load(key)
            .ok_or_else(|| "Album is not cached".to_string())?;
        let image = album
            .image(image_id)
            .cloned()
            .ok_or_else(|| "Image does not belong to this album".to_string())?;

        // Fetch before saving: a choice that cannot be displayed is not recorded.
        self.full_image_bytes(key, &image)
            .await
            .map_err(|error| error.to_string())?;

        album.selected_image_id = Some(image.id);
        self.cache
            .save(&album)
            .map_err(|error| format!("Could not save selection: {error}"))?;
        Ok(self.present(&album).await)
    }

    pub async fn set_placement(
        &self,
        key: &str,
        image_id: &str,
        placement: ArtPlacement,
    ) -> Result<AlbumArt, String> {
        let lock = self.album_lock(key);
        let _album_guard = lock.lock().await;

        let mut album = self
            .cache
            .load(key)
            .ok_or_else(|| "Album is not cached".to_string())?;
        if album.image(image_id).is_none() {
            return Err("Image does not belong to this album".to_string());
        }

        album
            .placements
            .insert(image_id.to_string(), placement.clamped());
        self.cache
            .save(&album)
            .map_err(|error| format!("Could not save placement: {error}"))?;
        Ok(self.present(&album).await)
    }

    /// Every edition on the album's Discogs page, listed once and then cached.
    pub async fn editions(&self, key: &str) -> Result<AlbumEditions, String> {
        let lock = self.album_lock(key);
        let _album_guard = lock.lock().await;

        let mut album = self
            .cache
            .load(key)
            .ok_or_else(|| "Album is not cached".to_string())?;
        if album.editions.is_empty() {
            let client = self
                .client
                .as_ref()
                .ok_or_else(|| "Discogs is not configured".to_string())?;
            let lookup = key
                .split_once('|')
                .and_then(|(artist, title)| AlbumLookup::new(artist, title))
                .ok_or_else(|| "Album key is invalid".to_string())?;
            let (editions, total) = fetch_editions(client, &lookup)
                .await
                .map_err(|error| error.to_string())?;
            album.editions = editions;
            album.editions_total = total;
            if let Err(error) = self.cache.save(&album) {
                eprintln!("[VinylDeck discogs] cache write failed: {error}");
            }
        }

        Ok(AlbumEditions {
            editions: album.editions.iter().map(public_edition).collect(),
            total_count: album.editions_total,
        })
    }

    /// An edition's name and images. Each first look costs one API request, so a
    /// `background` caller gets `None` instead of spending the last of the budget.
    pub async fn edition_details(
        &self,
        key: &str,
        release_id: u64,
        background: bool,
    ) -> Result<Option<EditionDetails>, String> {
        let album = self.album_with_edition(key, release_id)?;
        if let Some(details) = cached_edition_details(&album, release_id) {
            return Ok(Some(details));
        }

        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "Discogs is not configured".to_string())?;
        let _slot = self
            .edition_detail_slots
            .acquire()
            .await
            .map_err(|error| error.to_string())?;
        if background && !client.has_spare_requests() {
            return Ok(None);
        }

        // The album is not locked during the request, so choosing an image stays instant.
        let release = match client.release(release_id).await {
            Ok(release) => release,
            Err(DiscogsError::RateLimited { .. }) if background => return Ok(None),
            Err(error) => return Err(error.to_string()),
        };

        let lock = self.album_lock(key);
        let _album_guard = lock.lock().await;
        let mut album = self.album_with_edition(key, release_id)?;

        let name = join_edition_name(&release.formats);
        let mut collector = ImageCollector::default();
        let source = album
            .editions
            .iter()
            .find(|edition| edition.release_id == release_id)
            .map(edition_source)
            .unwrap_or_default();
        collector.add(release.images, &source);
        let mut images = collector.into_images();
        for image in &mut images {
            image.release_id = Some(release_id);
        }

        album.edition_images.insert(release_id, images);
        if let Some(edition) = album
            .editions
            .iter_mut()
            .find(|edition| edition.release_id == release_id)
        {
            edition.name = name;
        }
        if let Err(error) = self.cache.save(&album) {
            eprintln!("[VinylDeck discogs] cache write failed: {error}");
        }
        Ok(cached_edition_details(&album, release_id))
    }

    pub async fn edition_thumbnail(
        &self,
        key: &str,
        release_id: u64,
    ) -> Result<Option<String>, String> {
        let album = self.album_with_edition(key, release_id)?;
        let cache_id = format!("edition-{release_id}");
        if let Some(bytes) = self.cache.read_image(key, &cache_id, ImageVariant::Thumb) {
            return Ok(bytes_to_data_url(&bytes));
        }

        let url = album
            .editions
            .iter()
            .find(|edition| edition.release_id == release_id)
            .map(|edition| edition.thumb.as_str())
            .unwrap_or_default();
        if url.is_empty() {
            return Ok(None);
        }

        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "Discogs is not configured".to_string())?;
        let _slot = self
            .thumbnail_slots
            .acquire()
            .await
            .map_err(|error| error.to_string())?;
        let bytes = client
            .download_image(url)
            .await
            .map_err(|error| error.to_string())?;
        self.store_image(key, &cache_id, ImageVariant::Thumb, &bytes);
        Ok(bytes_to_data_url(&bytes))
    }

    /// Release ids arrive over IPC, so only those listed for this album are accepted.
    fn album_with_edition(&self, key: &str, release_id: u64) -> Result<CachedAlbum, String> {
        let album = self
            .cache
            .load(key)
            .ok_or_else(|| "Album is not cached".to_string())?;
        if album
            .editions
            .iter()
            .any(|edition| edition.release_id == release_id)
        {
            Ok(album)
        } else {
            Err("Edition does not belong to this album".to_string())
        }
    }

    pub async fn thumbnail(&self, key: &str, image_id: &str) -> Result<Option<String>, String> {
        let album = self
            .cache
            .load(key)
            .ok_or_else(|| "Album is not cached".to_string())?;
        let image = album
            .image(image_id)
            .ok_or_else(|| "Image does not belong to this album".to_string())?;

        if let Some(bytes) = self.cache.read_image(key, &image.id, ImageVariant::Thumb) {
            return Ok(bytes_to_data_url(&bytes));
        }

        let _slot = self
            .thumbnail_slots
            .acquire()
            .await
            .map_err(|error| error.to_string())?;

        let url = if image.uri150.is_empty() {
            &image.uri
        } else {
            &image.uri150
        };
        let downloaded = match &self.client {
            Some(client) => client.download_image(url).await,
            None => Err(DiscogsError::Network("no client".to_string())),
        };
        match downloaded {
            Ok(bytes) => {
                self.store_image(key, &image.id, ImageVariant::Thumb, &bytes);
                Ok(bytes_to_data_url(&bytes))
            }
            // Offline: the full-size copy can still stand in as a thumbnail.
            Err(error) => match self.cache.read_image(key, &image.id, ImageVariant::Full) {
                Some(bytes) => Ok(bytes_to_data_url(&bytes)),
                None => Err(error.to_string()),
            },
        }
    }

    /// Turns a cache record into the IPC response, loading the artwork to display.
    async fn present(&self, album: &CachedAlbum) -> AlbumArt {
        if album.images.is_empty() {
            return AlbumArt::without_images(&album.key, AlbumArtStatus::NotFound, None);
        }

        let (displayed_id, artwork_data_url, retry_after_seconds) =
            self.displayed_artwork(album).await;
        let placement = displayed_id
            .as_deref()
            .map(|id| album.placement(id))
            .unwrap_or_default();
        let selected_release_id = displayed_id
            .as_deref()
            .and_then(|id| album.image(id))
            .and_then(|image| image.release_id);

        AlbumArt {
            key: album.key.clone(),
            status: AlbumArtStatus::Found,
            images: album.images.iter().map(public_image).collect(),
            selected_image_id: displayed_id,
            artwork_data_url,
            placement,
            selected_release_id,
            retry_after_seconds,
        }
    }

    async fn displayed_artwork(
        &self,
        album: &CachedAlbum,
    ) -> (Option<String>, Option<String>, Option<u64>) {
        // A user's choice is honored exclusively; never silently swapped for another.
        let chosen = album
            .selected_image_id
            .as_deref()
            .and_then(|id| album.image(id));
        let candidates: Vec<&CachedImage> = match chosen {
            Some(image) => vec![image],
            None => album.images.iter().collect(),
        };

        let mut retry_after_seconds = None;
        for image in candidates {
            match self.full_image_bytes(&album.key, image).await {
                Ok(bytes) => {
                    if let Some(url) = bytes_to_data_url(&bytes) {
                        return (Some(image.id.clone()), Some(url), None);
                    }
                }
                // This one image is gone or unusable: try the next automatic default.
                Err(DiscogsError::Http(_)) | Err(DiscogsError::InvalidImage) => {}
                // Discogs is unreachable: other images would fail the same way.
                Err(error) => {
                    eprintln!("[VinylDeck discogs] image download failed: {error}");
                    retry_after_seconds = retry_hint(&error);
                    break;
                }
            }
        }
        (
            chosen.map(|image| image.id.clone()),
            None,
            retry_after_seconds,
        )
    }

    async fn full_image_bytes(
        &self,
        key: &str,
        image: &CachedImage,
    ) -> Result<Vec<u8>, DiscogsError> {
        if let Some(bytes) = self.cache.read_image(key, &image.id, ImageVariant::Full) {
            return Ok(bytes);
        }
        let client = self
            .client
            .as_ref()
            .ok_or_else(|| DiscogsError::Network("Discogs is not configured".to_string()))?;
        let bytes = match image.release_id.filter(|_| image.uri.is_empty()) {
            Some(release_id) => {
                let uri = release_primary_uri(client, release_id).await?;
                client.download_image(&uri).await?
            }
            None => client.download_image(&image.uri).await?,
        };
        self.store_image(key, &image.id, ImageVariant::Full, &bytes);
        Ok(bytes)
    }

    /// A failed cache write only costs a later re-download, so it never fails the caller.
    fn store_image(&self, key: &str, id: &str, variant: ImageVariant, bytes: &[u8]) {
        if let Err(error) = self.cache.write_image(key, id, variant, bytes) {
            eprintln!("[VinylDeck discogs] image cache write failed: {error}");
        }
    }
}

fn public_image(image: &CachedImage) -> AlbumArtImage {
    AlbumArtImage {
        id: image.id.clone(),
        kind: image.kind.clone(),
        width: image.width,
        height: image.height,
        source: image.source.clone(),
    }
}

fn public_edition(edition: &CachedEdition) -> AlbumEdition {
    AlbumEdition {
        release_id: edition.release_id,
        title: edition.title.clone(),
        major_format: edition.major_format.clone(),
        format: edition.format.clone(),
        country: edition.country.clone(),
        year: edition.year.clone(),
        label: edition.label.clone(),
        catno: edition.catno.clone(),
        name: edition.name.clone(),
    }
}

fn cached_edition_details(album: &CachedAlbum, release_id: u64) -> Option<EditionDetails> {
    let images = album.edition_images.get(&release_id)?;
    Some(EditionDetails {
        name: album
            .editions
            .iter()
            .find(|edition| edition.release_id == release_id)
            .and_then(|edition| edition.name.clone()),
        images: images.iter().map(public_image).collect(),
    })
}

fn retry_hint(error: &DiscogsError) -> Option<u64> {
    match error {
        DiscogsError::RateLimited {
            retry_after_seconds,
        } => Some(*retry_after_seconds),
        DiscogsError::Network(_) | DiscogsError::Http(_) | DiscogsError::InvalidResponse(_) => {
            Some(NETWORK_RETRY_SECONDS)
        }
        DiscogsError::Unauthorized | DiscogsError::InvalidImage => None,
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

// ── Discogs lookup strategy ───────────────────────────────────

/// Masters group every version of an album, so they are tried first. Releases cover
/// albums without a master. An empty result means "searched, nothing usable".
async fn fetch_album_images(
    client: &DiscogsClient,
    lookup: &AlbumLookup,
) -> Result<Vec<CachedImage>, DiscogsError> {
    let masters = client
        .search("master", &lookup.search_artist, &lookup.search_album)
        .await?;
    if let Some(master) = rank_results(lookup, masters).first() {
        let images = fetch_master_images(client, master.id).await?;
        if !images.is_empty() {
            return Ok(images);
        }
    }

    let mut titles = vec![lookup.search_album.as_str()];
    if lookup.raw_album != lookup.search_album {
        titles.push(lookup.raw_album.as_str());
    }
    for title in titles {
        let releases = client
            .search("release", &lookup.search_artist, title)
            .await?;
        let images = fetch_release_images(client, rank_results(lookup, releases)).await?;
        if !images.is_empty() {
            return Ok(images);
        }
    }
    Ok(Vec::new())
}

fn rank_results(lookup: &AlbumLookup, results: Vec<SearchResult>) -> Vec<SearchResult> {
    let mut scored: Vec<(f32, SearchResult)> = results
        .into_iter()
        .filter_map(|result| {
            lookup
                .score(&result.title, &result.format)
                .map(|score| (score, result))
        })
        .collect();
    scored.sort_by(|(score_a, a), (score_b, b)| {
        score_b
            .total_cmp(score_a)
            .then_with(|| community_have(b).cmp(&community_have(a)))
    });
    scored.into_iter().map(|(_, result)| result).collect()
}

fn community_have(result: &SearchResult) -> u64 {
    result
        .community
        .as_ref()
        .map_or(0, |community| community.have)
}

async fn fetch_master_images(
    client: &DiscogsClient,
    master_id: u64,
) -> Result<Vec<CachedImage>, DiscogsError> {
    let master = client.master(master_id).await?;
    let (primary, photos): (Vec<ImageDto>, Vec<ImageDto>) = master
        .images
        .into_iter()
        .partition(|image| image.kind == PRIMARY_KIND);

    // Covers lead, so the shared image limit can never crowd them out with photos.
    let mut collector = ImageCollector::default();
    collector.add(primary, MAIN_RELEASE_SOURCE);

    // A single request lists every version's cover. They are a bonus, so failing
    // here (for example, hitting the rate limit) keeps what was already found.
    match client.versions(master_id).await {
        Ok(versions) => {
            for version in cover_versions(versions, master.main_release) {
                collector.add_version_cover(&version);
            }
        }
        Err(error) => eprintln!("[VinylDeck discogs] versions skipped: {error}"),
    }

    collector.add(photos, MAIN_RELEASE_SOURCE);
    Ok(collector.into_images())
}

/// A version's full-size cover costs an API request, so it is only looked up once
/// that cover is actually chosen.
async fn release_primary_uri(
    client: &DiscogsClient,
    release_id: u64,
) -> Result<String, DiscogsError> {
    let release = client.release(release_id).await?;
    let images = release.images;
    images
        .iter()
        .find(|image| image.kind == PRIMARY_KIND)
        .or(images.first())
        .map(|image| image.uri.clone())
        .filter(|uri| !uri.is_empty())
        .ok_or(DiscogsError::Http(404))
}

async fn fetch_release_images(
    client: &DiscogsClient,
    releases: Vec<SearchResult>,
) -> Result<Vec<CachedImage>, DiscogsError> {
    let mut collector = ImageCollector::default();
    for (index, result) in releases.iter().take(EXTRA_RELEASES_PER_ALBUM).enumerate() {
        match client.release(result.id).await {
            Ok(release) => collector.add(release.images, &search_result_source(result)),
            // The best match decides the outcome; later ones are only extras.
            Err(error) if index == 0 => return Err(error),
            Err(error) => {
                eprintln!("[VinylDeck discogs] release {} skipped: {error}", result.id);
                break;
            }
        }
    }
    Ok(collector.into_images())
}

/// The album's page lists versions under a master; an album without one has only the
/// releases a search finds.
async fn fetch_editions(
    client: &DiscogsClient,
    lookup: &AlbumLookup,
) -> Result<(Vec<CachedEdition>, u32), DiscogsError> {
    let masters = client
        .search("master", &lookup.search_artist, &lookup.search_album)
        .await?;
    let (mut editions, total) = match rank_results(lookup, masters).first() {
        Some(master) => fetch_master_editions(client, master.id).await?,
        None => {
            let releases = client
                .search("release", &lookup.search_artist, &lookup.search_album)
                .await?;
            let editions: Vec<CachedEdition> = rank_results(lookup, releases)
                .iter()
                .map(search_result_edition)
                .collect();
            let total = editions.len() as u32;
            (editions, total)
        }
    };
    sort_editions(&mut editions);
    Ok((editions, total))
}

/// Keeps the pages already read if a later one fails: a long list beats no list.
async fn fetch_master_editions(
    client: &DiscogsClient,
    master_id: u64,
) -> Result<(Vec<CachedEdition>, u32), DiscogsError> {
    let first = client.versions_page(master_id, 1).await?;
    let pagination = first.pagination.as_ref();
    let pages = pagination.map_or(1, |value| value.pages);
    let mut total = pagination.map_or(0, |value| value.items);
    let mut editions: Vec<CachedEdition> = first.versions.iter().map(version_edition).collect();

    for page in 2..=pages.min(MAX_EDITION_PAGES) {
        match client.versions_page(master_id, page).await {
            Ok(next) => editions.extend(next.versions.iter().map(version_edition)),
            Err(error) => {
                eprintln!("[VinylDeck discogs] editions page {page} skipped: {error}");
                break;
            }
        }
    }

    total = total.max(editions.len() as u32);
    Ok((editions, total))
}

fn version_edition(version: &VersionDto) -> CachedEdition {
    CachedEdition {
        release_id: version.id,
        title: version.title.trim().to_string(),
        major_format: version.major_formats.first().cloned().unwrap_or_default(),
        format: version.format.clone(),
        country: version.country.clone(),
        year: version.released.get(..4).unwrap_or("").to_string(),
        label: version.label.clone(),
        catno: version.catno.clone(),
        thumb: version.thumb.clone(),
        collectors: version_collectors(version),
        name: None,
    }
}

fn search_result_edition(result: &SearchResult) -> CachedEdition {
    // "Artist - Album", and formats with the main one first.
    let title = result
        .title
        .split_once(" - ")
        .map_or(result.title.as_str(), |(_, album)| album);
    CachedEdition {
        release_id: result.id,
        title: title.trim().to_string(),
        major_format: result.format.first().cloned().unwrap_or_default(),
        format: result
            .format
            .iter()
            .skip(1)
            .cloned()
            .collect::<Vec<_>>()
            .join(", "),
        country: result.country.clone(),
        year: search_result_year(result),
        label: result.label.first().cloned().unwrap_or_default(),
        catno: result.catno.clone(),
        thumb: result.thumb.clone(),
        collectors: community_have(result),
        name: None,
    }
}

/// Vinyl first since this is a record player, then the most collected.
fn sort_editions(editions: &mut [CachedEdition]) {
    editions.sort_by_key(|edition| {
        (
            edition.major_format != VINYL_FORMAT,
            std::cmp::Reverse(edition.collectors),
        )
    });
}

fn join_edition_name(formats: &[client::ReleaseFormat]) -> Option<String> {
    let name = formats
        .iter()
        .map(|format| format.text.trim())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join(" + ");
    (!name.is_empty()).then_some(name)
}

fn edition_source(edition: &CachedEdition) -> String {
    join_source(&[&edition.major_format, &edition.country, &edition.year])
}

/// Vinyl first since this is a record player, then the most collected. Bootlegs are
/// left out: their covers are often not the album's.
fn cover_versions(mut versions: Vec<VersionDto>, main_release: u64) -> Vec<VersionDto> {
    versions.retain(|version| {
        version.id != main_release
            && !version.thumb.is_empty()
            && !version.format.contains(UNOFFICIAL_FORMAT)
    });
    versions.sort_by_key(|version| {
        let is_vinyl = version.major_formats.iter().any(|format| format == "Vinyl");
        (!is_vinyl, std::cmp::Reverse(version_collectors(version)))
    });
    versions.truncate(MAX_VERSION_COVERS);
    versions
}

fn version_collectors(version: &VersionDto) -> u64 {
    version
        .stats
        .as_ref()
        .and_then(|stats| stats.community.as_ref())
        .map_or(0, |community| community.in_collection)
}

fn version_source(version: &VersionDto) -> String {
    join_source(&[
        version.major_formats.first().map_or("", String::as_str),
        &version.country,
        version.released.get(..4).unwrap_or(""),
    ])
}

fn search_result_year(result: &SearchResult) -> String {
    match &result.year {
        Some(serde_json::Value::String(year)) => year.clone(),
        Some(serde_json::Value::Number(year)) => year.to_string(),
        _ => String::new(),
    }
}

fn search_result_source(result: &SearchResult) -> String {
    let year = search_result_year(result);
    join_source(&[
        result.format.first().map_or("", String::as_str),
        result.label.first().map_or("", String::as_str),
        &year,
    ])
}

fn join_source(parts: &[&str]) -> String {
    parts
        .iter()
        .filter(|part| !part.trim().is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join(" · ")
}

#[derive(Default)]
struct ImageCollector {
    seen: HashSet<String>,
    images: Vec<CachedImage>,
}

impl ImageCollector {
    /// Primary images lead each group, so the first image overall is the album's
    /// primary image: the automatic default.
    fn add(&mut self, mut images: Vec<ImageDto>, source: &str) {
        images.sort_by_key(|image| image.kind != PRIMARY_KIND);
        for image in images {
            if image.uri.is_empty()
                || self.images.len() >= MAX_IMAGES_PER_ALBUM
                || !self.seen.insert(image.uri.clone())
            {
                continue;
            }
            self.images.push(CachedImage {
                id: CachedImage::id_for_uri(&image.uri),
                kind: image.kind,
                uri: image.uri,
                uri150: image.uri150,
                width: image.width,
                height: image.height,
                source: source.to_string(),
                release_id: None,
            });
        }
    }

    fn add_version_cover(&mut self, version: &VersionDto) {
        if self.images.len() >= MAX_IMAGES_PER_ALBUM || !self.seen.insert(version.thumb.clone()) {
            return;
        }
        self.images.push(CachedImage {
            id: CachedImage::id_for_uri(&version.thumb),
            kind: PRIMARY_KIND.to_string(),
            uri: String::new(),
            uri150: version.thumb.clone(),
            width: 0,
            height: 0,
            source: version_source(version),
            release_id: Some(version.id),
        });
    }

    fn into_images(self) -> Vec<CachedImage> {
        self.images
    }
}

// ── Tauri surface ─────────────────────────────────────────────

fn load_credentials() -> Option<Credentials> {
    // Development convenience only. Release builds read the real environment and
    // never scan directories for a .env file.
    #[cfg(debug_assertions)]
    let _ = dotenvy::dotenv();

    Credentials::from_lookup(|name| std::env::var(name).ok())
}

pub fn initialize(app: &AppHandle) {
    let client = match load_credentials() {
        Some(credentials) => match DiscogsClient::new(Some(&credentials)) {
            Ok(client) => Some(client),
            Err(error) => {
                eprintln!("[VinylDeck discogs] client unavailable: {error}");
                None
            }
        },
        None => {
            eprintln!("[VinylDeck discogs] no credentials set, using player artwork only");
            None
        }
    };

    let cache_root = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("VinylDeck"))
        .join("discogs");
    app.manage(DiscogsService::new(client, cache_root));
}

#[tauri::command]
pub async fn cmd_discogs_resolve(
    service: State<'_, DiscogsService>,
    artist: String,
    album: String,
) -> Result<AlbumArt, String> {
    Ok(service.resolve(&artist, &album).await)
}

#[tauri::command]
pub async fn cmd_discogs_select(
    app: AppHandle,
    service: State<'_, DiscogsService>,
    key: String,
    image_id: String,
) -> Result<AlbumArt, String> {
    let art = service.select(&key, &image_id).await?;
    emit_art_changed(&app, &art);
    Ok(art)
}

#[tauri::command]
pub async fn cmd_discogs_set_placement(
    app: AppHandle,
    service: State<'_, DiscogsService>,
    key: String,
    image_id: String,
    placement: ArtPlacement,
) -> Result<AlbumArt, String> {
    let art = service.set_placement(&key, &image_id, placement).await?;
    emit_art_changed(&app, &art);
    Ok(art)
}

/// Main and mini must both follow a choice without another lookup.
fn emit_art_changed(app: &AppHandle, art: &AlbumArt) {
    if let Err(error) = app.emit(ART_CHANGED_EVENT, art) {
        eprintln!("[VinylDeck discogs] event emit failed: {error}");
    }
}

#[tauri::command]
pub async fn cmd_discogs_editions(
    service: State<'_, DiscogsService>,
    key: String,
) -> Result<AlbumEditions, String> {
    service.editions(&key).await
}

#[tauri::command]
pub async fn cmd_discogs_edition_details(
    service: State<'_, DiscogsService>,
    key: String,
    release_id: u64,
    background: bool,
) -> Result<Option<EditionDetails>, String> {
    service.edition_details(&key, release_id, background).await
}

#[tauri::command]
pub async fn cmd_discogs_edition_thumbnail(
    service: State<'_, DiscogsService>,
    key: String,
    release_id: u64,
) -> Result<Option<String>, String> {
    service.edition_thumbnail(&key, release_id).await
}

#[tauri::command]
pub async fn cmd_discogs_thumbnail(
    service: State<'_, DiscogsService>,
    key: String,
    image_id: String,
) -> Result<Option<String>, String> {
    service.thumbnail(&key, &image_id).await
}

#[cfg(test)]
mod tests;
