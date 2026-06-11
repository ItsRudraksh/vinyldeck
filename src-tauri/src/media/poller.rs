use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};

use tauri::AppHandle;

use super::{emit_media_snapshot, model::MediaSnapshot};

const SMTC_POLL_INTERVAL_MS: u64 = 500;
static SMTC_POLLER_STARTED: AtomicBool = AtomicBool::new(false);

pub fn start_smtc_poller(app: AppHandle) {
    if SMTC_POLLER_STARTED
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        eprintln!("[VinylDeck SMTC] poller already running");
        return;
    }

    if let Err(error) = thread::Builder::new()
        .name("vinyldeck-smtc-poller".to_string())
        .spawn(move || {
            let poll_interval = Duration::from_millis(SMTC_POLL_INTERVAL_MS);
            let mut poller = SmtcPoller::default();

            loop {
                thread::sleep(poll_interval);
                if let Err(error) = tauri::async_runtime::block_on(poll_once(&app, &mut poller)) {
                    eprintln!("[VinylDeck SMTC] poll error: {error}");
                }
            }
        })
    {
        SMTC_POLLER_STARTED.store(false, Ordering::Release);
        eprintln!("[VinylDeck SMTC] failed to start poller: {error}");
    }
}

async fn poll_once(app: &AppHandle, poller: &mut SmtcPoller) -> anyhow::Result<()> {
    if let Some(snapshot) = poller.snapshot_for_poll().await? {
        emit_media_snapshot(app, &snapshot);
    }

    Ok(())
}

#[derive(Debug, Default)]
struct SmtcPoller {
    cached_media: Option<CachedMedia>,
}

impl SmtcPoller {
    async fn snapshot_for_poll(&mut self) -> anyhow::Result<Option<MediaSnapshot>> {
        let Some(lightweight) = super::smtc::current_lightweight_snapshot().await? else {
            self.cached_media = None;
            return Ok(None);
        };

        let cache_key = TrackCacheKey::from_snapshot(&lightweight);
        if self
            .cached_media
            .as_ref()
            .is_some_and(|cached| cached.key == cache_key)
        {
            return Ok(Some(apply_cached_media(
                lightweight,
                self.cached_media.as_ref(),
            )));
        }

        let Some(full_snapshot) = super::smtc::current_media_snapshot_with_artwork().await? else {
            self.cached_media = None;
            return Ok(Some(lightweight));
        };

        self.cached_media = Some(CachedMedia::from_snapshot(&full_snapshot));
        Ok(Some(full_snapshot))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrackCacheKey {
    source_id: String,
    duration_millis: u64,
}

impl TrackCacheKey {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            source_id: snapshot.source_id.clone(),
            duration_millis: seconds_to_millis(snapshot.duration),
        }
    }
}

#[derive(Debug, Clone)]
struct CachedMedia {
    key: TrackCacheKey,
    track: String,
    artist: String,
    album: String,
    artwork_data_url: Option<String>,
}

impl CachedMedia {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            key: TrackCacheKey::from_snapshot(snapshot),
            track: snapshot.track.clone(),
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
            artwork_data_url: snapshot.artwork_data_url.clone(),
        }
    }
}

fn apply_cached_media(
    mut lightweight: MediaSnapshot,
    cached: Option<&CachedMedia>,
) -> MediaSnapshot {
    if let Some(cached) = cached {
        lightweight.track = cached.track.clone();
        lightweight.artist = cached.artist.clone();
        lightweight.album = cached.album.clone();
        lightweight.artwork_data_url = cached.artwork_data_url.clone();
    }

    lightweight
}

fn seconds_to_millis(seconds: f64) -> u64 {
    if !seconds.is_finite() || seconds <= 0.0 {
        return 0;
    }

    (seconds * 1000.0).round() as u64
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};

    use super::{apply_cached_media, CachedMedia, MediaSnapshot, TrackCacheKey};

    fn claim_start(flag: &AtomicBool) -> bool {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    #[test]
    fn start_guard_allows_only_one_poller() {
        let flag = AtomicBool::new(false);

        assert!(claim_start(&flag));
        assert!(!claim_start(&flag));
    }

    #[test]
    fn track_cache_key_uses_source_and_duration() {
        let base = MediaSnapshot {
            source_id: "spotify".to_string(),
            duration: 120.25,
            ..MediaSnapshot::default()
        };
        let same = MediaSnapshot {
            position: 42.0,
            ..base.clone()
        };
        let different_duration = MediaSnapshot {
            duration: 121.0,
            ..base.clone()
        };
        let different_source = MediaSnapshot {
            source_id: "chrome".to_string(),
            ..base.clone()
        };

        assert_eq!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&same)
        );
        assert_ne!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&different_duration)
        );
        assert_ne!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&different_source)
        );
    }

    #[test]
    fn cached_media_merges_onto_lightweight_snapshot() {
        let full = MediaSnapshot {
            track: "Track".to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            artwork_data_url: Some("data:image/png;base64,AAAA".to_string()),
            duration: 180.0,
            position: 7.0,
            source_id: "spotify".to_string(),
            ..MediaSnapshot::default()
        };
        let lightweight = MediaSnapshot {
            duration: 180.0,
            position: 9.0,
            is_playing: true,
            source_id: "spotify".to_string(),
            ..MediaSnapshot::default()
        };

        let merged = apply_cached_media(lightweight, Some(&CachedMedia::from_snapshot(&full)));

        assert_eq!(merged.track, "Track");
        assert_eq!(merged.artist, "Artist");
        assert_eq!(merged.album, "Album");
        assert_eq!(
            merged.artwork_data_url,
            Some("data:image/png;base64,AAAA".to_string())
        );
        assert_eq!(merged.position, 9.0);
        assert!(merged.is_playing);
    }
}
