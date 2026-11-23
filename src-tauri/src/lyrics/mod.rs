use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{Mutex, Semaphore};

const LYRICSPLUS_MIRRORS: &[&str] = &[
    "https://lyricsplus.prjktla.workers.dev",
    "https://lyricsplus.binimum.org",
    "https://lyricsplus.atomix.one",
];
const BETTERLYRICS_ENDPOINT: &str = "https://lyrics-api.boidu.dev/getLyrics";
const LRCLIB_GET_ENDPOINT: &str = "https://lrclib.net/api/get";
const LRCLIB_SEARCH_ENDPOINT: &str = "https://lrclib.net/api/search";
const GTX_TRANSLATE_ENDPOINT: &str = "https://translate.googleapis.com/translate_a/single";

const CACHE_FILE_NAME: &str = "lyrics_cache_v1.json";
const CACHE_SCHEMA_VERSION: u32 = 1;
const MAX_DISK_CACHE_ENTRIES: usize = 250;
const MAX_NEGATIVE_CACHE_ENTRIES: usize = 64;
const MAX_CONCURRENT_ENRICH: usize = 5;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsQuery {
    pub track: String,
    pub artist: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub duration: u32,
    #[serde(default)]
    pub bypass_cache: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RawLyricsResponse {
    pub provider: String,
    pub format: String,
    pub payload: String,
    pub plain_lyrics: Option<String>,
    pub instrumental: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsEnrichQuery {
    pub track_key: String,
    pub lines: Vec<String>,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LyricsEnrichResponse {
    pub source_lang: String,
    pub romanized_lines: Vec<String>,
    pub translated_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedTrackEntry {
    last_accessed_ms: u64,
    response: RawLyricsResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedEnrichEntry {
    last_accessed_ms: u64,
    response: LyricsEnrichResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedLyricsCache {
    version: u32,
    #[serde(default)]
    tracks: HashMap<String, CachedTrackEntry>,
    #[serde(default)]
    enrichments: HashMap<String, CachedEnrichEntry>,
}

impl Default for PersistedLyricsCache {
    fn default() -> Self {
        Self {
            version: CACHE_SCHEMA_VERSION,
            tracks: HashMap::new(),
            enrichments: HashMap::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrcLibRecord {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    #[serde(default)]
    instrumental: bool,
    duration: Option<f64>,
}

pub struct LyricsState {
    client: Client,
    cache_path: Mutex<Option<PathBuf>>,
    tracks: Mutex<HashMap<String, CachedTrackEntry>>,
    enrichments: Mutex<HashMap<String, CachedEnrichEntry>>,
    /// Session-only negative cache (never persisted to disk so offline misses recover on restart).
    negative_cache: Mutex<HashMap<String, u64>>,
}

impl LyricsState {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent("VinylDeck/0.1.1 (https://github.com/ItsRudraksh/vinyldeck-2)")
            .timeout(Duration::from_secs(6))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            cache_path: Mutex::new(None),
            tracks: Mutex::new(HashMap::new()),
            enrichments: Mutex::new(HashMap::new()),
            negative_cache: Mutex::new(HashMap::new()),
        }
    }
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn evict_lru_tracks(map: &mut HashMap<String, CachedTrackEntry>, max_entries: usize) {
    while map.len() > max_entries {
        let oldest_key = map
            .iter()
            .min_by_key(|(_, entry)| entry.last_accessed_ms)
            .map(|(k, _)| k.clone());
        match oldest_key {
            Some(k) => {
                map.remove(&k);
            }
            None => break,
        }
    }
}

fn evict_lru_enrichments(map: &mut HashMap<String, CachedEnrichEntry>, max_entries: usize) {
    while map.len() > max_entries {
        let oldest_key = map
            .iter()
            .min_by_key(|(_, entry)| entry.last_accessed_ms)
            .map(|(k, _)| k.clone());
        match oldest_key {
            Some(k) => {
                map.remove(&k);
            }
            None => break,
        }
    }
}

fn write_cache_atomic(path: &PathBuf, payload: &PersistedLyricsCache) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp_path = path.with_extension("json.tmp");
    let serialized = serde_json::to_vec(payload)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(&tmp_path, serialized)?;
    std::fs::rename(&tmp_path, path)?;
    Ok(())
}

/// Loads persisted LRU lyrics + enrichment cache from Tauri's app-data directory.
/// Non-fatal on missing or corrupt files so startup never fails.
pub async fn initialize_lyrics_cache(app: AppHandle) {
    let Some(state) = app.try_state::<LyricsState>() else {
        return;
    };

    let Ok(app_dir) = app.path().app_data_dir() else {
        return;
    };
    let path = app_dir.join(CACHE_FILE_NAME);

    {
        let mut path_guard = state.cache_path.lock().await;
        *path_guard = Some(path.clone());
    }

    let read_path = path.clone();
    let loaded = tokio::task::spawn_blocking(move || -> Option<PersistedLyricsCache> {
        let bytes = std::fs::read(&read_path).ok()?;
        let parsed: PersistedLyricsCache = serde_json::from_slice(&bytes).ok()?;
        if parsed.version != CACHE_SCHEMA_VERSION {
            return None;
        }
        Some(parsed)
    })
    .await
    .ok()
    .flatten();

    if let Some(mut cache) = loaded {
        evict_lru_tracks(&mut cache.tracks, MAX_DISK_CACHE_ENTRIES);
        evict_lru_enrichments(&mut cache.enrichments, MAX_DISK_CACHE_ENTRIES);

        let mut tracks_guard = state.tracks.lock().await;
        *tracks_guard = cache.tracks;
        let mut enrich_guard = state.enrichments.lock().await;
        *enrich_guard = cache.enrichments;
    }
}

async fn schedule_disk_persist(state: &LyricsState) {
    let path_opt = state.cache_path.lock().await.clone();
    let Some(path) = path_opt else {
        return;
    };

    let snapshot = PersistedLyricsCache {
        version: CACHE_SCHEMA_VERSION,
        tracks: state.tracks.lock().await.clone(),
        enrichments: state.enrichments.lock().await.clone(),
    };

    tokio::task::spawn_blocking(move || {
        if let Err(error) = write_cache_atomic(&path, &snapshot) {
            eprintln!("[VinylDeck lyrics] failed to persist on-disk cache: {error}");
        }
    });
}

fn cache_key(query: &LyricsQuery) -> String {
    let bucket = if query.duration > 0 {
        (query.duration / 2) * 2
    } else {
        0
    };
    format!(
        "{}::{}::{}",
        query.artist.trim().to_lowercase(),
        query.track.trim().to_lowercase(),
        bucket
    )
}

#[tauri::command]
pub async fn cmd_lyrics_fetch(
    state: State<'_, LyricsState>,
    query: LyricsQuery,
) -> Result<Option<RawLyricsResponse>, String> {
    if query.track.trim().is_empty() {
        return Ok(None);
    }

    let key = cache_key(&query);
    if !query.bypass_cache {
        {
            let mut tracks = state.tracks.lock().await;
            if let Some(entry) = tracks.get_mut(&key) {
                entry.last_accessed_ms = now_unix_ms();
                return Ok(Some(entry.response.clone()));
            }
        }
        {
            let neg = state.negative_cache.lock().await;
            if neg.contains_key(&key) {
                return Ok(None);
            }
        }
    }

    let resolved = resolve_cascade(&state.client, &query).await;
    let now = now_unix_ms();

    match resolved {
        Some(ref hit) => {
            {
                let mut neg = state.negative_cache.lock().await;
                neg.remove(&key);
            }
            {
                let mut tracks = state.tracks.lock().await;
                tracks.insert(
                    key,
                    CachedTrackEntry {
                        last_accessed_ms: now,
                        response: hit.clone(),
                    },
                );
                evict_lru_tracks(&mut tracks, MAX_DISK_CACHE_ENTRIES);
            }
            schedule_disk_persist(&state).await;
        }
        None => {
            let mut neg = state.negative_cache.lock().await;
            if neg.len() >= MAX_NEGATIVE_CACHE_ENTRIES {
                if let Some(oldest) = neg
                    .iter()
                    .min_by_key(|(_, ts)| **ts)
                    .map(|(k, _)| k.clone())
                {
                    neg.remove(&oldest);
                }
            }
            neg.insert(key, now);
        }
    }

    Ok(resolved)
}

#[tauri::command]
pub async fn cmd_lyrics_enrich(
    state: State<'_, LyricsState>,
    query: LyricsEnrichQuery,
) -> Result<Option<LyricsEnrichResponse>, String> {
    if query.lines.is_empty() {
        return Ok(None);
    }

    let target_lang = query
        .target_lang
        .trim()
        .to_lowercase()
        .split(['-', '_'])
        .next()
        .unwrap_or("en")
        .to_string();

    let key = format!(
        "v2::{}::{}",
        query.track_key.trim().to_lowercase(),
        target_lang
    );

    {
        let mut enrichments = state.enrichments.lock().await;
        if let Some(entry) = enrichments.get_mut(&key) {
            entry.last_accessed_ms = now_unix_ms();
            return Ok(Some(entry.response.clone()));
        }
    }

    let enriched = fetch_gtx_enrichment_per_line(&state.client, &query.lines, &target_lang).await;

    if let Some(ref response) = enriched {
        {
            let mut enrichments = state.enrichments.lock().await;
            enrichments.insert(
                key,
                CachedEnrichEntry {
                    last_accessed_ms: now_unix_ms(),
                    response: response.clone(),
                },
            );
            evict_lru_enrichments(&mut enrichments, MAX_DISK_CACHE_ENTRIES);
        }
        schedule_disk_persist(&state).await;
    }

    Ok(enriched)
}

#[tauri::command]
pub async fn cmd_lyrics_clear_cache(state: State<'_, LyricsState>) -> Result<(), String> {
    state.tracks.lock().await.clear();
    state.enrichments.lock().await.clear();
    state.negative_cache.lock().await.clear();

    if let Some(path) = state.cache_path.lock().await.clone() {
        tokio::task::spawn_blocking(move || {
            let _ = std::fs::remove_file(path);
        });
    }

    Ok(())
}

fn parse_gtx_single_line(value: &Value) -> Option<(String, String, String)> {
    let segments = value.get(0)?.as_array()?;
    let mut translated_joined = String::new();
    let mut romanized_parts: Vec<String> = Vec::new();

    for seg in segments {
        let Some(tuple) = seg.as_array() else {
            continue;
        };
        if let Some(tr) = tuple.first().and_then(Value::as_str) {
            translated_joined.push_str(tr);
        }
        if let Some(rm) = tuple.get(3).and_then(Value::as_str) {
            let trimmed = rm.trim();
            if !trimmed.is_empty() {
                romanized_parts.push(trimmed.to_string());
            }
        }
    }

    let source_lang = value
        .get(2)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_lowercase()
        .split(['-', '_'])
        .next()
        .unwrap_or("")
        .to_string();

    let translated = translated_joined
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let romanized = romanized_parts
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    Some((source_lang, romanized, translated))
}

async fn fetch_single_line_gtx(
    client: &Client,
    line: &str,
    target_lang: &str,
) -> Option<(String, String, String)> {
    let params = [
        ("client", "gtx"),
        ("sl", "auto"),
        ("tl", target_lang),
        ("dt", "t"),
        ("dt", "rm"),
        ("q", line),
    ];

    let resp = client
        .get(GTX_TRANSLATE_ENDPOINT)
        .query(&params)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let json: Value = resp.json().await.ok()?;
    parse_gtx_single_line(&json)
}

/// Fetches translation + romanization per unique line with bounded concurrency
/// (MAX_CONCURRENT_ENRICH = 5). Querying one line per request guarantees exact
/// 1:1 line alignment and eliminates GTX's newline-collapsing paragraph bug.
async fn fetch_gtx_enrichment_per_line(
    client: &Client,
    lines: &[String],
    target_lang: &str,
) -> Option<LyricsEnrichResponse> {
    let mut unique_map: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, raw) in lines.iter().enumerate() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        unique_map
            .entry(trimmed.to_string())
            .or_default()
            .push(idx);
    }

    if unique_map.is_empty() {
        return None;
    }

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_ENRICH));
    let mut handles = Vec::with_capacity(unique_map.len());

    for (text, indices) in unique_map {
        let client_clone = client.clone();
        let lang_clone = target_lang.to_string();
        let sem_clone = Arc::clone(&semaphore);

        handles.push(tokio::spawn(async move {
            let _permit = sem_clone.acquire_owned().await.ok()?;
            let parsed = fetch_single_line_gtx(&client_clone, &text, &lang_clone).await?;
            Some((indices, parsed))
        }));
    }

    let mut all_romanized = vec![String::new(); lines.len()];
    let mut all_translated = vec![String::new(); lines.len()];
    let mut lang_counts: HashMap<String, usize> = HashMap::new();
    let mut any_success = false;

    for handle in handles {
        if let Ok(Some((indices, (src, rom, tr)))) = handle.await {
            any_success = true;
            if !src.is_empty() {
                *lang_counts.entry(src).or_insert(0) += indices.len();
            }
            for idx in indices {
                all_romanized[idx] = rom.clone();
                all_translated[idx] = tr.clone();
            }
        }
    }

    if !any_success {
        return None;
    }

    let detected_lang = lang_counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(lang, _)| lang)
        .unwrap_or_default();

    Some(LyricsEnrichResponse {
        source_lang: detected_lang,
        romanized_lines: all_romanized,
        translated_lines: all_translated,
    })
}

async fn resolve_cascade(client: &Client, query: &LyricsQuery) -> Option<RawLyricsResponse> {
    // Tier 1: LyricsPlus (word/syllable karaoke timings)
    let tier1 = fetch_lyricsplus(client, query).await;
    if let Some(ref hit) = tier1 {
        if hit.payload.contains("\"syllabus\"") || hit.payload.contains("\"Word\"") {
            return tier1;
        }
    }

    // Tier 2: BetterLyrics TTML (word/syllable timings)
    let tier2 = fetch_betterlyrics(client, query).await;
    if let Some(ref hit) = tier2 {
        if hit.payload.contains("<span") {
            return tier2;
        }
    }

    // Tier 3: LRCLIB (line-synced LRC, plain lyrics, or instrumental)
    if let Some(hit) = fetch_lrclib(client, query).await {
        if hit.format == "plain" {
            if let Some(timed_fallback) = tier1.or(tier2) {
                return Some(timed_fallback);
            }
        }
        return Some(hit);
    }

    tier1.or(tier2)
}

async fn fetch_lyricsplus(client: &Client, query: &LyricsQuery) -> Option<RawLyricsResponse> {
    let mut params: Vec<(&str, String)> = vec![
        ("title", query.track.clone()),
        ("artist", query.artist.clone()),
        ("source", "apple,musixmatch,spotify".to_string()),
    ];
    if !query.album.is_empty() {
        params.push(("album", query.album.clone()));
    }
    if query.duration > 0 {
        params.push(("duration", query.duration.to_string()));
    }

    for mirror in LYRICSPLUS_MIRRORS {
        let url = format!("{mirror}/v2/lyrics/get");
        let Ok(resp) = client
            .get(&url)
            .query(&params)
            .timeout(Duration::from_millis(3500))
            .send()
            .await
        else {
            continue;
        };

        if !resp.status().is_success() {
            continue;
        }

        let Ok(body) = resp.text().await else {
            continue;
        };
        if body.contains("\"lyrics\"") && body.len() > 24 {
            return Some(RawLyricsResponse {
                provider: "lyricsplus".to_string(),
                format: "lyricsplus_json".to_string(),
                payload: body,
                plain_lyrics: None,
                instrumental: false,
            });
        }
    }

    None
}

async fn fetch_betterlyrics(client: &Client, query: &LyricsQuery) -> Option<RawLyricsResponse> {
    let mut params: Vec<(&str, String)> = vec![
        ("s", query.track.clone()),
        ("a", query.artist.clone()),
    ];
    if !query.album.is_empty() {
        params.push(("al", query.album.clone()));
    }
    if query.duration > 0 {
        params.push(("d", query.duration.to_string()));
    }

    let resp = client
        .get(BETTERLYRICS_ENDPOINT)
        .query(&params)
        .timeout(Duration::from_millis(3500))
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let body = resp.text().await.ok()?;
    let ttml = if body.trim_start().starts_with('{') {
        let value: serde_json::Value = serde_json::from_str(&body).ok()?;
        value
            .get("ttml")
            .or_else(|| value.get("lyrics"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string()
    } else {
        body
    };

    if ttml.contains("<p") {
        Some(RawLyricsResponse {
            provider: "betterlyrics".to_string(),
            format: "ttml".to_string(),
            payload: ttml,
            plain_lyrics: None,
            instrumental: false,
        })
    } else {
        None
    }
}

fn map_lrclib_record(record: LrcLibRecord) -> Option<RawLyricsResponse> {
    if record.instrumental {
        return Some(RawLyricsResponse {
            provider: "lrclib".to_string(),
            format: "instrumental".to_string(),
            payload: String::new(),
            plain_lyrics: None,
            instrumental: true,
        });
    }

    if let Some(synced) = record.synced_lyrics.filter(|s| !s.trim().is_empty()) {
        return Some(RawLyricsResponse {
            provider: "lrclib".to_string(),
            format: "lrc".to_string(),
            payload: synced,
            plain_lyrics: record.plain_lyrics,
            instrumental: false,
        });
    }

    if let Some(plain) = record.plain_lyrics.filter(|s| !s.trim().is_empty()) {
        return Some(RawLyricsResponse {
            provider: "lrclib".to_string(),
            format: "plain".to_string(),
            payload: plain.clone(),
            plain_lyrics: Some(plain),
            instrumental: false,
        });
    }

    None
}

async fn fetch_lrclib(client: &Client, query: &LyricsQuery) -> Option<RawLyricsResponse> {
    let mut exact_params: Vec<(&str, String)> = vec![
        ("track_name", query.track.clone()),
        ("artist_name", query.artist.clone()),
    ];
    if !query.album.is_empty() {
        exact_params.push(("album_name", query.album.clone()));
    }
    if query.duration > 0 {
        exact_params.push(("duration", query.duration.to_string()));
    }

    if let Ok(resp) = client
        .get(LRCLIB_GET_ENDPOINT)
        .query(&exact_params)
        .timeout(Duration::from_secs(4))
        .send()
        .await
    {
        if resp.status().is_success() {
            if let Ok(record) = resp.json::<LrcLibRecord>().await {
                if let Some(mapped) = map_lrclib_record(record) {
                    return Some(mapped);
                }
            }
        }
    }

    // Fallback to fuzzy LRCLIB search
    let search_params = [
        ("track_name", query.track.as_str()),
        ("artist_name", query.artist.as_str()),
    ];
    let resp = client
        .get(LRCLIB_SEARCH_ENDPOINT)
        .query(&search_params)
        .timeout(Duration::from_secs(4))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }

    let mut records = resp.json::<Vec<LrcLibRecord>>().await.ok()?;
    let target = query.duration as f64;
    records.sort_by(|a, b| {
        let a_synced = if a.synced_lyrics.is_some() { 0 } else { 1 };
        let b_synced = if b.synced_lyrics.is_some() { 0 } else { 1 };
        a_synced.cmp(&b_synced).then_with(|| {
            if query.duration > 0 {
                let da = (a.duration.unwrap_or(target) - target).abs();
                let db = (b.duration.unwrap_or(target) - target).abs();
                da.total_cmp(&db)
            } else {
                std::cmp::Ordering::Equal
            }
        })
    });

    for candidate in records {
        if query.duration > 0 {
            if let Some(dur) = candidate.duration {
                if (dur - target).abs() > 12.0 {
                    continue;
                }
            }
        }
        if let Some(mapped) = map_lrclib_record(candidate) {
            return Some(mapped);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use serde_json::json;

    use super::{
        evict_lru_tracks, parse_gtx_single_line, CachedTrackEntry, PersistedLyricsCache,
        RawLyricsResponse, CACHE_SCHEMA_VERSION,
    };

    #[test]
    fn parses_gtx_single_line_translation_and_romanization() {
        let payload = json!([
            [
                ["I'd rather die", "死ぬのがいいわ", null, null, 10],
                [null, null, null, "Shinu no ga ii wa"]
            ],
            null,
            "ja"
        ]);

        let (src, rom, tr) = parse_gtx_single_line(&payload).expect("should parse gtx line");
        assert_eq!(src, "ja");
        assert_eq!(tr, "I'd rather die");
        assert_eq!(rom, "Shinu no ga ii wa");
    }

    #[test]
    fn evicts_least_recently_used_track_entries() {
        let mut map = HashMap::new();
        let sample = RawLyricsResponse {
            provider: "lrclib".to_string(),
            format: "lrc".to_string(),
            payload: "[00:01.00]Hello".to_string(),
            plain_lyrics: None,
            instrumental: false,
        };
        map.insert(
            "old".to_string(),
            CachedTrackEntry {
                last_accessed_ms: 100,
                response: sample.clone(),
            },
        );
        map.insert(
            "mid".to_string(),
            CachedTrackEntry {
                last_accessed_ms: 200,
                response: sample.clone(),
            },
        );
        map.insert(
            "new".to_string(),
            CachedTrackEntry {
                last_accessed_ms: 300,
                response: sample,
            },
        );

        evict_lru_tracks(&mut map, 2);
        assert_eq!(map.len(), 2);
        assert!(!map.contains_key("old"));
        assert!(map.contains_key("mid"));
        assert!(map.contains_key("new"));
    }

    #[test]
    fn persisted_cache_roundtrips_json() {
        let mut cache = PersistedLyricsCache::default();
        assert_eq!(cache.version, CACHE_SCHEMA_VERSION);
        cache.tracks.insert(
            "artist::track::180".to_string(),
            CachedTrackEntry {
                last_accessed_ms: 999,
                response: RawLyricsResponse {
                    provider: "betterlyrics".to_string(),
                    format: "ttml".to_string(),
                    payload: "<tt><p begin=\"1s\">Hi</p></tt>".to_string(),
                    plain_lyrics: None,
                    instrumental: false,
                },
            },
        );

        let bytes = serde_json::to_vec(&cache).expect("serialize");
        let decoded: PersistedLyricsCache = serde_json::from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded.version, CACHE_SCHEMA_VERSION);
        assert_eq!(decoded.tracks.len(), 1);
    }
}
