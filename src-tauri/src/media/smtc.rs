#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SmtcSessionMetadata {
    pub source_id: String,
    pub source_name: String,
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(current_lightweight_snapshot()
        .await?
        .map(|snapshot| SmtcSessionMetadata {
            source_id: snapshot.source_id,
            source_name: snapshot.source_name,
        }))
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    use super::model::{friendly_source_name, ticks_to_seconds};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let session = match manager.GetCurrentSession() {
        Ok(session) => session,
        Err(_) => return Ok(None),
    };

    let source_id = session
        .SourceAppUserModelId()
        .map(|value| value.to_string())
        .unwrap_or_default();
    let source_name = friendly_source_name(&source_id);
    let mut snapshot = super::model::MediaSnapshot {
        source_id,
        source_name,
        ..super::model::MediaSnapshot::default()
    };

    if let Ok(playback_info) = session.GetPlaybackInfo() {
        if let Ok(status) = playback_info.PlaybackStatus() {
            snapshot.is_playing =
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        }

        if let Ok(controls) = playback_info.Controls() {
            snapshot.can_seek = controls.IsPlaybackPositionEnabled().unwrap_or(false);
            snapshot.can_skip = controls.IsNextEnabled().unwrap_or(false)
                || controls.IsPreviousEnabled().unwrap_or(false);
            snapshot.can_control = controls.IsPlayEnabled().unwrap_or(false)
                || controls.IsPauseEnabled().unwrap_or(false);
        }
    }

    if let Ok(timeline) = session.GetTimelineProperties() {
        if let Ok(duration) = timeline.EndTime() {
            snapshot.duration = ticks_to_seconds(duration.Duration);
        }
        if let Ok(position) = timeline.Position() {
            snapshot.position = ticks_to_seconds(position.Duration);
        }
    }

    Ok(Some(snapshot))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(None)
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    Ok(None)
}
