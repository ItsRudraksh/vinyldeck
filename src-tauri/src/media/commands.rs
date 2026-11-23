use tauri::{AppHandle, Manager};

use super::{emit_media_snapshot, model::MediaSnapshot, MediaState};

async fn refresh_and_emit_smtc_snapshot(app: &AppHandle) -> Result<Option<MediaSnapshot>, String> {
    let mut snapshot = super::smtc::current_media_snapshot_with_metadata()
        .await
        .map_err(|error| error.to_string())?;

    let mut should_emit = true;

    if let Some(ref mut current) = snapshot {
        if current.artwork_data_url.is_none() {
            let prev = app
                .try_state::<MediaState>()
                .map(|state| state.snapshot())
                .unwrap_or_default();

            let same_track = !current.track.is_empty()
                && current.track == prev.track
                && current.artist == prev.artist
                && current.source_id == prev.source_id;

            if same_track && prev.artwork_data_url.is_some() {
                // Preserve cached cover art on same-track play/pause/seek so the vinyl label never flashes blank.
                current.artwork_data_url = prev.artwork_data_url;
            } else if !same_track && !current.track.is_empty() {
                // Track changed (Next/Previous): avoid emitting an artwork-less intermediate snapshot;
                // the dedicated SMTC poller thread fetches and emits the full snapshot with new artwork.
                should_emit = false;
            }
        }
    }

    if should_emit {
        let effective = snapshot.clone().unwrap_or_default();
        emit_media_snapshot(app, &effective);
    }

    Ok(snapshot)
}

#[tauri::command]
pub async fn cmd_smtc_snapshot(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    let mut snapshot = super::smtc::current_media_snapshot_with_metadata()
        .await
        .map_err(|error| error.to_string())?;

    if let Some(ref mut current) = snapshot {
        if current.artwork_data_url.is_none() {
            if let Some(state) = app.try_state::<MediaState>() {
                let prev = state.snapshot();
                if current.track == prev.track
                    && current.artist == prev.artist
                    && current.source_id == prev.source_id
                    && prev.artwork_data_url.is_some()
                {
                    current.artwork_data_url = prev.artwork_data_url;
                }
            }
        }
    }

    if let Some(state) = app.try_state::<MediaState>() {
        state.set_snapshot(snapshot.clone().unwrap_or_default());
    }

    Ok(snapshot)
}

#[tauri::command]
pub async fn cmd_smtc_play(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::play()
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(&app).await
}

#[tauri::command]
pub async fn cmd_smtc_pause(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::pause()
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(&app).await
}

#[tauri::command]
pub async fn cmd_smtc_toggle_play_pause(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    smtc_toggle_play_pause(&app).await
}

#[tauri::command]
pub async fn cmd_smtc_next(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    smtc_next(&app).await
}

#[tauri::command]
pub async fn cmd_smtc_previous(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    smtc_previous(&app).await
}

#[tauri::command]
pub async fn cmd_smtc_seek(app: AppHandle, seconds: f64) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::seek(seconds)
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(&app).await
}

/// Shared SMTC helpers invoked by both the frontend IPC commands and the System Tray.
pub async fn smtc_toggle_play_pause(app: &AppHandle) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::toggle_play_pause()
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(app).await
}

pub async fn smtc_next(app: &AppHandle) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::next()
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(app).await
}

pub async fn smtc_previous(app: &AppHandle) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::previous()
        .await
        .map_err(|error| error.to_string())?;
    refresh_and_emit_smtc_snapshot(app).await
}
