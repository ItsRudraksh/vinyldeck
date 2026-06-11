mod media;
mod settings;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(media::MediaState::new())
        .manage(settings::SettingsState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .on_window_event(tray::handle_window_close)
        .invoke_handler(tauri::generate_handler![
            media::commands::cmd_media_snapshot,
            media::commands::cmd_media_play,
            media::commands::cmd_media_pause,
            media::commands::cmd_media_toggle_play_pause,
            media::commands::cmd_media_next,
            media::commands::cmd_media_previous,
            media::commands::cmd_media_seek,
            settings::cmd_settings_snapshot,
            settings::cmd_settings_update,
            settings::cmd_settings_reset,
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(settings::initialize_settings(app_handle))?;
            media::start_mock_media_loop(app.handle().clone());
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
