#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SmtcSessionMetadata {
    pub source_id: String,
    pub source_name: String,
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    use super::model::friendly_source_name;
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

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

    Ok(Some(SmtcSessionMetadata {
        source_id,
        source_name,
    }))
}

#[cfg(not(windows))]
#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(None)
}
