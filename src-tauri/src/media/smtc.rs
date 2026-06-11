#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SmtcSessionMetadata {
    pub source_id: String,
    pub source_name: String,
}

const TICKS_PER_SECOND: f64 = 10_000_000.0;

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(current_media_snapshot_with_metadata()
        .await?
        .map(|snapshot| SmtcSessionMetadata {
            source_id: snapshot.source_id,
            source_name: snapshot.source_name,
        }))
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_media_snapshot_with_metadata(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some(session) = current_session().await? else {
        return Ok(None);
    };

    let mut snapshot = current_lightweight_snapshot_from_session(&session);
    if let Ok(properties) = session.TryGetMediaPropertiesAsync()?.await {
        snapshot.track = properties
            .Title()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.artist = properties
            .Artist()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.album = properties
            .AlbumTitle()
            .map(|value| value.to_string())
            .unwrap_or_default();
    }

    Ok(Some(snapshot))
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some(session) = current_session().await? else {
        return Ok(None);
    };

    Ok(Some(current_lightweight_snapshot_from_session(&session)))
}

#[cfg(windows)]
async fn current_session(
) -> anyhow::Result<Option<windows::Media::Control::GlobalSystemMediaTransportControlsSession>> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    match manager.GetCurrentSession() {
        Ok(session) => Ok(Some(session)),
        Err(_) => Ok(None),
    }
}

#[cfg(windows)]
async fn current_session_for_command(
) -> anyhow::Result<windows::Media::Control::GlobalSystemMediaTransportControlsSession> {
    current_session()
        .await?
        .ok_or_else(|| anyhow::anyhow!("No active media session"))
}

#[cfg(windows)]
fn current_lightweight_snapshot_from_session(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> super::model::MediaSnapshot {
    use super::model::{friendly_source_name, ticks_to_seconds};
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

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

    snapshot
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn play() -> anyhow::Result<()> {
    let session = current_session_for_command().await?;
    require_command_accepted(session.TryPlayAsync()?.await?, "play")
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn pause() -> anyhow::Result<()> {
    let session = current_session_for_command().await?;
    require_command_accepted(session.TryPauseAsync()?.await?, "pause")
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn toggle_play_pause() -> anyhow::Result<()> {
    let session = current_session_for_command().await?;
    require_command_accepted(
        session.TryTogglePlayPauseAsync()?.await?,
        "toggle play/pause",
    )
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn next() -> anyhow::Result<()> {
    let session = current_session_for_command().await?;
    require_command_accepted(session.TrySkipNextAsync()?.await?, "next")
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn previous() -> anyhow::Result<()> {
    let session = current_session_for_command().await?;
    require_command_accepted(session.TrySkipPreviousAsync()?.await?, "previous")
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn seek(position_seconds: f64) -> anyhow::Result<()> {
    let ticks = seconds_to_ticks(position_seconds)?;
    let session = current_session_for_command().await?;
    require_command_accepted(
        session.TryChangePlaybackPositionAsync(ticks)?.await?,
        "seek",
    )
}

fn require_command_accepted(accepted: bool, action: &'static str) -> anyhow::Result<()> {
    if accepted {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Media source rejected {action} command"))
    }
}

pub(crate) fn seconds_to_ticks(seconds: f64) -> anyhow::Result<i64> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err(anyhow::anyhow!(
            "Seek position must be finite and non-negative"
        ));
    }

    let ticks = seconds * TICKS_PER_SECOND;
    if ticks > i64::MAX as f64 {
        return Err(anyhow::anyhow!("Seek position is too large"));
    }

    Ok(ticks.round() as i64)
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(None)
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_media_snapshot_with_metadata(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    Ok(None)
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    Ok(None)
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn play() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn pause() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn toggle_play_pause() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn next() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn previous() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn seek(_position_seconds: f64) -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "SMTC commands are only available on Windows"
    ))
}

#[cfg(test)]
mod tests {
    use super::{require_command_accepted, seconds_to_ticks};

    #[test]
    fn converts_seek_seconds_to_windows_ticks() {
        assert_eq!(seconds_to_ticks(0.0).unwrap(), 0);
        assert_eq!(seconds_to_ticks(1.0).unwrap(), 10_000_000);
        assert_eq!(seconds_to_ticks(12.345_678_9).unwrap(), 123_456_789);
    }

    #[test]
    fn rejects_invalid_seek_seconds() {
        assert!(seconds_to_ticks(f64::NAN).is_err());
        assert!(seconds_to_ticks(f64::INFINITY).is_err());
        assert!(seconds_to_ticks(-0.001).is_err());
        assert!(seconds_to_ticks(i64::MAX as f64).is_err());
    }

    #[test]
    fn command_rejection_becomes_error() {
        assert!(require_command_accepted(true, "play").is_ok());

        let error = require_command_accepted(false, "play")
            .expect_err("false command result must become an error")
            .to_string();
        assert_eq!(error, "Media source rejected play command");
    }
}
