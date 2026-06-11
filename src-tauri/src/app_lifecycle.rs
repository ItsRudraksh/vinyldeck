use tauri::{AppHandle, Manager};

use crate::window::{MAIN_LABEL, MINI_LABEL};

#[tauri::command]
pub fn cmd_quit(app: AppHandle) {
    quit(&app);
}

pub(crate) fn quit(app: &AppHandle) {
    for label in [MINI_LABEL, MAIN_LABEL] {
        if let Some(window) = app.get_webview_window(label) {
            if let Err(error) = window.destroy() {
                eprintln!("[VinylDeck lifecycle] failed to destroy {label}: {error}");
            }
        }
    }

    app.exit(0);
}
