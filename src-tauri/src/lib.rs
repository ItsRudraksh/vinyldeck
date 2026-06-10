mod media;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(media::MediaState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            media::commands::cmd_media_snapshot,
            media::commands::cmd_media_play,
            media::commands::cmd_media_pause,
            media::commands::cmd_media_toggle_play_pause,
            media::commands::cmd_media_next,
            media::commands::cmd_media_previous,
            media::commands::cmd_media_seek,
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
        ])
        .setup(|app| {
            media::start_mock_media_loop(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
