use tauri::{AppHandle, State};

use super::{emit_media_snapshot, model::MediaSnapshot, MediaState};

#[tauri::command]
pub async fn cmd_media_snapshot(state: State<'_, MediaState>) -> Result<MediaSnapshot, String> {
    Ok(state.snapshot().await)
}

#[tauri::command]
pub async fn cmd_media_play(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_play(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_pause(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_pause(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_toggle_play_pause(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_toggle_play_pause(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_next(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_next(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_previous(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_previous(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_seek(
    app: AppHandle,
    state: State<'_, MediaState>,
    seconds: f64,
) -> Result<MediaSnapshot, String> {
    let snapshot = state.seek_to(seconds).await;
    emit_media_snapshot(&app, &snapshot);
    Ok(snapshot)
}

pub async fn media_play(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.play().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_pause(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.pause().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_toggle_play_pause(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.toggle_play_pause().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_next(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.next().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_previous(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.previous().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}
