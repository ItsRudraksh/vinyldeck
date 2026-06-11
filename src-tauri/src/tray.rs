use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};

use crate::{
    media::{self, MediaState},
    window::{self, WindowMode, MAIN_LABEL, MINI_LABEL},
};

pub const TRAY_ID: &str = "vinyldeck-tray";
pub const MENU_OPEN: &str = "open-vinyldeck";
pub const MENU_MINI: &str = "mini-player";
pub const MENU_PLAY_PAUSE: &str = "play-pause";
pub const MENU_PREVIOUS: &str = "previous";
pub const MENU_NEXT: &str = "next";
pub const MENU_QUIT: &str = "quit";

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open VinylDeck", true, None::<&str>)?;
    let mini = MenuItem::with_id(app, MENU_MINI, "Mini Player", true, None::<&str>)?;
    let play_pause = MenuItem::with_id(app, MENU_PLAY_PAUSE, "Play/Pause", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, MENU_PREVIOUS, "Previous", true, None::<&str>)?;
    let next = MenuItem::with_id(app, MENU_NEXT, "Next", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;
    let separator_a = PredefinedMenuItem::separator(app)?;
    let separator_b = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &open,
            &mini,
            &separator_a,
            &play_pause,
            &previous,
            &next,
            &separator_b,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("VinylDeck")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_OPEN => set_tray_window_mode(app, WindowMode::Main),
            MENU_MINI => set_tray_window_mode(app, WindowMode::Mini),
            MENU_PLAY_PAUSE => control_media_from_tray(app, TrayMediaAction::TogglePlayPause),
            MENU_PREVIOUS => control_media_from_tray(app, TrayMediaAction::Previous),
            MENU_NEXT => control_media_from_tray(app, TrayMediaAction::Next),
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                set_tray_window_mode(tray.app_handle(), WindowMode::Main);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;

    Ok(())
}

pub fn handle_window_close(window: &tauri::Window, event: &tauri::WindowEvent) {
    let tauri::WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    if !matches!(window.label(), MAIN_LABEL | MINI_LABEL) {
        return;
    }

    api.prevent_close();
    if let Err(error) = window.hide() {
        eprintln!(
            "[VinylDeck tray] failed to hide {} on close request: {error}",
            window.label()
        );
    }
}

fn set_tray_window_mode(app: &AppHandle, mode: WindowMode) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = window::set_window_mode(&app, mode) {
            eprintln!("[VinylDeck tray] failed to set window mode: {error}");
        }
    });
}

#[derive(Debug, Clone, Copy)]
enum TrayMediaAction {
    TogglePlayPause,
    Previous,
    Next,
}

fn control_media_from_tray(app: &AppHandle, action: TrayMediaAction) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Some(state) = app.try_state::<MediaState>() else {
            eprintln!("[VinylDeck tray] media state unavailable for tray control");
            return;
        };

        match action {
            TrayMediaAction::TogglePlayPause => {
                media::commands::media_toggle_play_pause(&app, &state).await;
            }
            TrayMediaAction::Previous => {
                media::commands::media_previous(&app, &state).await;
            }
            TrayMediaAction::Next => {
                media::commands::media_next(&app, &state).await;
            }
        }
    });
}
