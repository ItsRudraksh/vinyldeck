mod media;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
