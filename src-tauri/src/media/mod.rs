use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

pub mod artwork;
pub mod commands;
pub mod model;
pub mod poller;
pub mod smtc;

use model::MediaSnapshot;

pub const MEDIA_SNAPSHOT_EVENT: &str = "media-state-changed";

/// Holds the latest live SMTC snapshot emitted by the poller or SMTC commands
/// so the System Tray stays 100% synchronized with the active media session
/// without redundant WinRT polling. Uses a fast std::sync::Mutex so both sync
/// and async callers can read/update safely without nested runtime hazards.
pub struct MediaState {
    latest_snapshot: Mutex<MediaSnapshot>,
}

impl MediaState {
    pub fn new() -> Self {
        Self {
            latest_snapshot: Mutex::new(MediaSnapshot::default()),
        }
    }

    pub fn snapshot(&self) -> MediaSnapshot {
        self.latest_snapshot
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    pub fn set_snapshot(&self, snapshot: MediaSnapshot) {
        if let Ok(mut guard) = self.latest_snapshot.lock() {
            *guard = snapshot;
        }
    }
}

pub fn emit_media_snapshot(app: &AppHandle, snapshot: &MediaSnapshot) {
    if let Some(state) = app.try_state::<MediaState>() {
        state.set_snapshot(snapshot.clone());
    }

    if let Err(error) = app.emit(MEDIA_SNAPSHOT_EVENT, snapshot) {
        eprintln!("[VinylDeck media] failed to emit snapshot: {error}");
    }
}
