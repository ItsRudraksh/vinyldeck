use std::str::FromStr;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const MAIN_LABEL: &str = "main";
const MINI_LABEL: &str = "mini";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowMode {
    Main,
    Fullscreen,
    Mini,
}

impl FromStr for WindowMode {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "main" => Ok(Self::Main),
            "fullscreen" => Ok(Self::Fullscreen),
            "mini" => Ok(Self::Mini),
            other => Err(format!("Unknown window mode: {other}")),
        }
    }
}

#[tauri::command]
pub fn cmd_set_window_mode(app: AppHandle, mode: String) -> Result<(), String> {
    set_window_mode(&app, WindowMode::from_str(&mode)?)
}

#[tauri::command]
pub fn cmd_set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    for label in [MAIN_LABEL, MINI_LABEL] {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_always_on_top(enabled)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn set_window_mode(app: &AppHandle, mode: WindowMode) -> Result<(), String> {
    match mode {
        WindowMode::Main => show_main(app),
        WindowMode::Fullscreen => show_fullscreen(app),
        WindowMode::Mini => show_mini(app),
    }
}

fn show_main(app: &AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        mini.hide().map_err(|error| error.to_string())?;
    }

    let main = app
        .get_webview_window(MAIN_LABEL)
        .ok_or_else(|| "Main window not found".to_string())?;

    main.set_fullscreen(false)
        .map_err(|error| error.to_string())?;
    main.set_decorations(true)
        .map_err(|error| error.to_string())?;
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn show_fullscreen(app: &AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        mini.hide().map_err(|error| error.to_string())?;
    }

    let main = app
        .get_webview_window(MAIN_LABEL)
        .ok_or_else(|| "Main window not found".to_string())?;

    main.show().map_err(|error| error.to_string())?;
    main.set_decorations(false)
        .map_err(|error| error.to_string())?;
    main.set_fullscreen(true)
        .map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn show_mini(app: &AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        main.hide().map_err(|error| error.to_string())?;
    }

    let mini = match app.get_webview_window(MINI_LABEL) {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, MINI_LABEL, WebviewUrl::App("index.html".into()))
            .title("VinylDeck Mini")
            .inner_size(280.0, 280.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()
            .map_err(|error| error.to_string())?,
    };

    mini.show().map_err(|error| error.to_string())?;
    mini.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::WindowMode;
    use std::str::FromStr;

    #[test]
    fn parses_valid_modes() {
        assert_eq!(WindowMode::from_str("main"), Ok(WindowMode::Main));
        assert_eq!(
            WindowMode::from_str("fullscreen"),
            Ok(WindowMode::Fullscreen)
        );
        assert_eq!(WindowMode::from_str("mini"), Ok(WindowMode::Mini));
    }

    #[test]
    fn rejects_invalid_modes() {
        assert_eq!(
            WindowMode::from_str("compact"),
            Err("Unknown window mode: compact".to_string())
        );
    }
}
