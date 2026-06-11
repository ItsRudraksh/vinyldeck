use std::sync::atomic::{AtomicBool, Ordering};

use tauri::AppHandle;
use tokio::time::{interval, Duration};

use super::emit_media_snapshot;

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

    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(SMTC_POLL_INTERVAL_MS));

        loop {
            ticker.tick().await;
            if let Err(error) = poll_once(&app).await {
                eprintln!("[VinylDeck SMTC] poll error: {error}");
            }
        }
    });
}

async fn poll_once(app: &AppHandle) -> anyhow::Result<()> {
    if let Some(snapshot) = super::smtc::current_lightweight_snapshot().await? {
        emit_media_snapshot(app, &snapshot);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};

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
}
