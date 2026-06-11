use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

pub mod artwork;
pub mod commands;
mod mock;
pub mod model;
pub mod smtc;

use mock::MockMediaAuthority;
use model::MediaSnapshot;

pub const MEDIA_SNAPSHOT_EVENT: &str = "media-state-changed";
const MEDIA_TICK_MS: u64 = 500;

pub struct MediaState {
    authority: Mutex<MockMediaAuthority>,
}

impl MediaState {
    pub fn new() -> Self {
        Self {
            authority: Mutex::new(MockMediaAuthority::new()),
        }
    }

    pub async fn snapshot(&self) -> MediaSnapshot {
        self.authority.lock().await.snapshot()
    }

    pub async fn play(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.play();
        authority.snapshot()
    }

    pub async fn pause(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.pause();
        authority.snapshot()
    }

    pub async fn toggle_play_pause(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.toggle_play_pause();
        authority.snapshot()
    }

    pub async fn next(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.next();
        authority.snapshot()
    }

    pub async fn previous(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.previous();
        authority.snapshot()
    }

    pub async fn seek_to(&self, seconds: f64) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.seek_to(seconds);
        authority.snapshot()
    }

    async fn tick(&self) -> Option<MediaSnapshot> {
        let mut authority = self.authority.lock().await;
        authority.tick()
    }
}

pub fn start_mock_media_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(MEDIA_TICK_MS));

        loop {
            ticker.tick().await;
            let Some(state) = app.try_state::<MediaState>() else {
                continue;
            };
            if let Some(snapshot) = state.tick().await {
                emit_media_snapshot(&app, &snapshot);
            }
        }
    });
}

pub fn emit_media_snapshot(app: &AppHandle, snapshot: &MediaSnapshot) {
    if let Err(error) = app.emit(MEDIA_SNAPSHOT_EVENT, snapshot) {
        eprintln!("[VinylDeck media] failed to emit snapshot: {error}");
    }
}
