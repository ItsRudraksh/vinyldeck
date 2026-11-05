//! On-disk album cache. One folder per album, so a corrupt or missing album never
//! affects another and nothing has to be loaded at startup:
//!
//!   <root>/albums/<sha256(key)>/album.json   search result + the user's choices
//!   <root>/albums/<sha256(key)>/<id>.full    selected artwork bytes (offline use)
//!   <root>/albums/<sha256(key)>/<id>.thumb   picker thumbnail bytes

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const FOUND_TTL_SECONDS: u64 = 30 * 24 * 60 * 60;
const NOT_FOUND_TTL_SECONDS: u64 = 7 * 24 * 60 * 60;

/// A square fits inside the circle at about 71%; a non-square image needs less.
const MIN_ZOOM_PERCENT: u16 = 50;
const MAX_ZOOM_PERCENT: u16 = 300;
const MAX_OFFSET_PERCENT: i16 = 100;
const DEFAULT_ZOOM_PERCENT: u16 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ImageVariant {
    Full,
    Thumb,
}

impl ImageVariant {
    fn extension(self) -> &'static str {
        match self {
            Self::Full => "full",
            Self::Thumb => "thumb",
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArtMode {
    /// A photo of a record fills the disc; any other image goes on the center.
    #[default]
    Auto,
    Center,
    Disc,
}

/// How one image sits on the record. Whole numbers keep it exact across saves.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtPlacement {
    pub mode: ArtMode,
    pub zoom_percent: u16,
    /// Shift from the center, as a percentage of the area the image fills.
    pub offset_x: i16,
    pub offset_y: i16,
}

impl Default for ArtPlacement {
    fn default() -> Self {
        Self {
            mode: ArtMode::Auto,
            zoom_percent: DEFAULT_ZOOM_PERCENT,
            offset_x: 0,
            offset_y: 0,
        }
    }
}

impl ArtPlacement {
    /// Values arrive over IPC: out-of-range ones must not push the art off the record.
    pub(crate) fn clamped(self) -> Self {
        Self {
            mode: self.mode,
            zoom_percent: self.zoom_percent.clamp(MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT),
            offset_x: self.offset_x.clamp(-MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
            offset_y: self.offset_y.clamp(-MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CachedImage {
    pub(crate) id: String,
    pub(crate) kind: String,
    /// Empty for a version's cover until it is needed: see `release_id`.
    pub(crate) uri: String,
    pub(crate) uri150: String,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) source: String,
    /// Where to find the full-size image when `uri` is empty.
    #[serde(default)]
    pub(crate) release_id: Option<u64>,
}

impl CachedImage {
    pub(crate) fn id_for_uri(uri: &str) -> String {
        hex_digest(uri)[..16].to_string()
    }
}

/// One pressing or format of an album, as listed on its Discogs page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CachedEdition {
    pub(crate) release_id: u64,
    pub(crate) title: String,
    /// Vinyl, CD, Cassette...
    pub(crate) major_format: String,
    /// Descriptors such as "LP, Album, Limited Edition".
    pub(crate) format: String,
    pub(crate) country: String,
    pub(crate) year: String,
    pub(crate) label: String,
    pub(crate) catno: String,
    pub(crate) thumb: String,
    pub(crate) collectors: u64,
    /// "Alternate Cover 2", "Glow In The Dark". Only known once its details are fetched.
    #[serde(default)]
    pub(crate) name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CachedAlbum {
    pub(crate) key: String,
    pub(crate) fetched_at: u64,
    /// Empty means Discogs had no usable match or no images (a cached negative).
    pub(crate) images: Vec<CachedImage>,
    /// Only ever set by the user. Without it, the first image is the automatic default.
    pub(crate) selected_image_id: Option<String>,
    /// By image id. Absent means the default placement.
    #[serde(default)]
    pub(crate) placements: HashMap<String, ArtPlacement>,
    /// Empty until the user browses them. A refresh clears them, to be listed again.
    #[serde(default)]
    pub(crate) editions: Vec<CachedEdition>,
    /// How many editions Discogs has, which a very long list may exceed.
    #[serde(default)]
    pub(crate) editions_total: u32,
    /// By release id. A present entry means its details were fetched, even if empty.
    #[serde(default)]
    pub(crate) edition_images: HashMap<u64, Vec<CachedImage>>,
}

impl CachedAlbum {
    pub(crate) fn is_fresh(&self, now: u64) -> bool {
        let ttl = if self.images.is_empty() {
            NOT_FOUND_TTL_SECONDS
        } else {
            FOUND_TTL_SECONDS
        };
        now.saturating_sub(self.fetched_at) < ttl
    }

    /// Any image the user can choose, including those from an edition they opened.
    pub(crate) fn image(&self, id: &str) -> Option<&CachedImage> {
        self.images
            .iter()
            .chain(self.edition_images.values().flatten())
            .find(|image| image.id == id)
    }

    pub(crate) fn placement(&self, id: &str) -> ArtPlacement {
        self.placements.get(id).copied().unwrap_or_default()
    }

    /// Applies a refreshed search without ever discarding the user's choices: a
    /// chosen image that Discogs no longer lists stays available at the front.
    pub(crate) fn refreshed(
        previous: Option<&Self>,
        key: &str,
        now: u64,
        images: Vec<CachedImage>,
    ) -> Self {
        let mut merged = images;
        let selected_image_id = previous.and_then(|album| album.selected_image_id.clone());

        if let (Some(previous), Some(selected)) = (previous, selected_image_id.as_deref()) {
            if !merged.iter().any(|image| image.id == selected) {
                // An edition's image stays in its edition, not among the album's own.
                if let Some(kept) = previous.images.iter().find(|image| image.id == selected) {
                    merged.insert(0, kept.clone());
                }
            }
        }

        Self {
            key: key.to_string(),
            fetched_at: now,
            images: merged,
            selected_image_id,
            placements: previous
                .map(|album| album.placements.clone())
                .unwrap_or_default(),
            editions: Vec::new(),
            editions_total: 0,
            edition_images: previous
                .map(|album| album.edition_images.clone())
                .unwrap_or_default(),
        }
    }
}

pub(crate) struct AlbumCache {
    root: PathBuf,
}

impl AlbumCache {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// A missing or unreadable record reads as "not cached" so it gets refetched.
    pub(crate) fn load(&self, key: &str) -> Option<CachedAlbum> {
        let bytes = fs::read(self.album_dir(key).join("album.json")).ok()?;
        let album: CachedAlbum = serde_json::from_slice(&bytes).ok()?;
        (album.key == key).then_some(album)
    }

    pub(crate) fn save(&self, album: &CachedAlbum) -> io::Result<()> {
        let json = serde_json::to_vec_pretty(album)?;
        write_atomic(&self.album_dir(&album.key).join("album.json"), &json)
    }

    pub(crate) fn read_image(&self, key: &str, id: &str, variant: ImageVariant) -> Option<Vec<u8>> {
        fs::read(self.image_path(key, id, variant))
            .ok()
            .filter(|bytes| !bytes.is_empty())
    }

    pub(crate) fn write_image(
        &self,
        key: &str,
        id: &str,
        variant: ImageVariant,
        bytes: &[u8],
    ) -> io::Result<()> {
        write_atomic(&self.image_path(key, id, variant), bytes)
    }

    fn album_dir(&self, key: &str) -> PathBuf {
        self.root.join("albums").join(&hex_digest(key)[..32])
    }

    fn image_path(&self, key: &str, id: &str, variant: ImageVariant) -> PathBuf {
        // Ids arrive over IPC: hashing keeps them from ever forming a path.
        self.album_dir(key)
            .join(format!("{}.{}", &hex_digest(id)[..32], variant.extension()))
    }
}

fn hex_digest(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Write-then-rename, so a crash mid-write never destroys a saved choice.
fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path has no parent"))?;
    fs::create_dir_all(parent)?;

    let temporary = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("data")
    ));
    fs::write(&temporary, bytes)?;
    fs::rename(&temporary, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static NEXT_DIR: AtomicU32 = AtomicU32::new(0);

    pub(crate) fn temp_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "vinyldeck-cache-test-{}-{}",
            std::process::id(),
            NEXT_DIR.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&root);
        root
    }

    fn image(id: &str) -> CachedImage {
        CachedImage {
            id: id.to_string(),
            kind: "primary".to_string(),
            uri: format!("https://i.discogs.com/{id}.jpeg"),
            uri150: String::new(),
            width: 600,
            height: 600,
            source: "Main release".to_string(),
            release_id: None,
        }
    }

    fn album(images: Vec<CachedImage>, selected: Option<&str>, fetched_at: u64) -> CachedAlbum {
        CachedAlbum {
            key: "artist|album".to_string(),
            fetched_at,
            images,
            selected_image_id: selected.map(str::to_string),
            placements: HashMap::new(),
            editions: Vec::new(),
            editions_total: 0,
            edition_images: HashMap::new(),
        }
    }

    #[test]
    fn album_round_trips_and_keeps_keys_apart() {
        let root = temp_root();
        let cache = AlbumCache::new(root.clone());
        let saved = album(vec![image("a")], Some("a"), 5);
        cache.save(&saved).unwrap();

        assert_eq!(cache.load("artist|album"), Some(saved));
        assert_eq!(cache.load("artist|other"), None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn corrupt_record_reads_as_not_cached() {
        let root = temp_root();
        let cache = AlbumCache::new(root.clone());
        cache.save(&album(vec![], None, 5)).unwrap();
        fs::write(cache.album_dir("artist|album").join("album.json"), b"{oops").unwrap();

        assert_eq!(cache.load("artist|album"), None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn image_bytes_round_trip_per_variant() {
        let root = temp_root();
        let cache = AlbumCache::new(root.clone());
        cache
            .write_image("artist|album", "a", ImageVariant::Full, b"full")
            .unwrap();

        assert_eq!(
            cache.read_image("artist|album", "a", ImageVariant::Full),
            Some(b"full".to_vec())
        );
        assert_eq!(
            cache.read_image("artist|album", "a", ImageVariant::Thumb),
            None
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn hostile_image_id_stays_inside_album_folder() {
        let cache = AlbumCache::new(PathBuf::from("root"));
        let path = cache.image_path("k", "..\\..\\evil", ImageVariant::Full);
        assert!(path.starts_with(cache.album_dir("k")));
        assert!(!path.to_string_lossy().contains("evil"));
    }

    #[test]
    fn freshness_uses_shorter_ttl_for_negative_results() {
        let found = album(vec![image("a")], None, 0);
        let missing = album(vec![], None, 0);
        let eight_days = 8 * 24 * 60 * 60;

        assert!(found.is_fresh(eight_days));
        assert!(!missing.is_fresh(eight_days));
        assert!(!found.is_fresh(FOUND_TTL_SECONDS));
    }

    #[test]
    fn refresh_keeps_user_choice_even_when_discogs_drops_it() {
        let previous = album(vec![image("old"), image("b")], Some("old"), 0);
        let refreshed = CachedAlbum::refreshed(
            Some(&previous),
            "artist|album",
            9,
            vec![image("b"), image("c")],
        );

        assert_eq!(refreshed.selected_image_id.as_deref(), Some("old"));
        assert_eq!(refreshed.images[0].id, "old");
        assert_eq!(refreshed.images.len(), 3);
        assert_eq!(refreshed.fetched_at, 9);
    }

    #[test]
    fn refresh_keeps_a_choice_from_an_edition_without_listing_it_as_the_albums() {
        let mut previous = album(vec![image("a")], Some("e"), 0);
        previous.edition_images.insert(5, vec![image("e")]);

        let refreshed =
            CachedAlbum::refreshed(Some(&previous), "artist|album", 9, vec![image("a")]);

        assert_eq!(refreshed.images, vec![image("a")]);
        assert_eq!(refreshed.selected_image_id.as_deref(), Some("e"));
        assert_eq!(refreshed.image("e"), Some(&image("e")));
    }

    #[test]
    fn refresh_keeps_placements() {
        let placement = ArtPlacement {
            mode: ArtMode::Disc,
            zoom_percent: 140,
            offset_x: 5,
            offset_y: -5,
        };
        let mut previous = album(vec![image("a")], None, 0);
        previous.placements.insert("a".to_string(), placement);

        let refreshed =
            CachedAlbum::refreshed(Some(&previous), "artist|album", 9, vec![image("a")]);

        assert_eq!(refreshed.placement("a"), placement);
    }

    #[test]
    fn album_saved_before_placements_existed_still_loads() {
        let root = temp_root();
        let cache = AlbumCache::new(root.clone());
        let old_record =
            r#"{"key":"artist|album","fetchedAt":5,"images":[],"selectedImageId":null}"#;
        write_atomic(
            &cache.album_dir("artist|album").join("album.json"),
            old_record.as_bytes(),
        )
        .unwrap();

        let loaded = cache.load("artist|album").expect("old record loads");
        assert_eq!(loaded.placement("a"), ArtPlacement::default());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn placement_reads_what_the_frontend_sends() {
        let placement: ArtPlacement =
            serde_json::from_str(r#"{"mode":"disc","zoomPercent":140,"offsetX":-12,"offsetY":7}"#)
                .unwrap();
        assert_eq!(
            placement,
            ArtPlacement {
                mode: ArtMode::Disc,
                zoom_percent: 140,
                offset_x: -12,
                offset_y: 7,
            }
        );
        assert_eq!(
            serde_json::to_string(&ArtPlacement::default()).unwrap(),
            r#"{"mode":"auto","zoomPercent":100,"offsetX":0,"offsetY":0}"#
        );
        assert!(serde_json::from_str::<ArtPlacement>(
            r#"{"mode":"sideways","zoomPercent":100,"offsetX":0,"offsetY":0}"#
        )
        .is_err());
    }

    #[test]
    fn placement_values_are_clamped_to_the_record() {
        let wild = ArtPlacement {
            mode: ArtMode::Center,
            zoom_percent: 9000,
            offset_x: -900,
            offset_y: 900,
        }
        .clamped();
        assert_eq!(wild.zoom_percent, MAX_ZOOM_PERCENT);
        assert_eq!(wild.offset_x, -MAX_OFFSET_PERCENT);
        assert_eq!(wild.offset_y, MAX_OFFSET_PERCENT);

        let tiny = ArtPlacement {
            zoom_percent: 1,
            ..ArtPlacement::default()
        };
        assert_eq!(tiny.clamped().zoom_percent, MIN_ZOOM_PERCENT);
    }

    #[test]
    fn refresh_without_choice_uses_new_list_unchanged() {
        let previous = album(vec![image("old")], None, 0);
        let refreshed =
            CachedAlbum::refreshed(Some(&previous), "artist|album", 9, vec![image("b")]);

        assert_eq!(refreshed.selected_image_id, None);
        assert_eq!(refreshed.images, vec![image("b")]);
    }
}
