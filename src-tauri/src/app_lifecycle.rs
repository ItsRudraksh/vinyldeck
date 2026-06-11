use tauri::AppHandle;

#[tauri::command]
pub fn cmd_quit(app: AppHandle) {
    app.exit(0);
}
