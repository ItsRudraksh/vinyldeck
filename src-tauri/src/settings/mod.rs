use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

use crate::window::{self, MINI_LABEL};

pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";

const STORE_FILE: &str = "settings.json";
const STORE_KEY: &str = "settings";
const VERSION: u8 = 2;

const SHELL_THEMES: &[&str] = &["noir", "glass"];
const LEGACY_THEMES: &[&str] = &["noir", "glass", "aurora", "vapor", "paper"];
const WINDOW_MODES: &[&str] = &["main", "fullscreen", "mini"];
const LYRICS_LAYOUTS: &[&str] = &["split", "strip"];
const LYRICS_FONT_FAMILIES: &[&str] = &["display", "sans", "serif", "mono"];
const LYRICS_FONT_SIZES: &[&str] = &["sm", "md", "lg", "xl"];
const LYRICS_SIDES: &[&str] = &["right", "left"];
const LYRICS_TARGET_LANGS: &[&str] = &[
    "en", "es", "fr", "de", "hi", "pa", "ja", "ko", "zh", "pt", "ar", "ru",
];

fn default_lyrics_enabled() -> bool {
    true
}

fn default_lyrics_layout() -> String {
    "split".to_string()
}

fn default_lyrics_target_lang() -> String {
    "en".to_string()
}

fn default_lyrics_auto_romanize() -> bool {
    true
}

fn default_lyrics_font_family() -> String {
    "display".to_string()
}

fn default_lyrics_font_size() -> String {
    "md".to_string()
}

fn default_lyrics_side() -> String {
    "right".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    pub version: u8,
    pub theme: String,
    pub ambient_mode: String,
    /// Legacy compatibility. Derived from ambient_mode but kept in payloads so
    /// older frontend callers/tests do not fail abruptly during migration.
    pub art_ambient: bool,
    pub vinyl_wobble: bool,
    pub film_grain: bool,
    pub lean_back_mode: bool,
    pub cursor_hide: bool,
    pub idle_timeout_seconds: u8,
    pub always_on_top: bool,
    pub keyboard_shortcuts_enabled: bool,
    pub quit_to_tray: bool,
    pub start_with_windows: bool,
    pub window_mode: String,
    /// Mini-only: applies a native Windows Acrylic blur-through effect on the
    /// Mini window and lets its own background go fully transparent.
    pub mini_transparent_mode: bool,
    #[serde(default = "default_lyrics_enabled")]
    pub lyrics_enabled: bool,
    #[serde(default = "default_lyrics_layout")]
    pub lyrics_layout: String,
    #[serde(default)]
    pub lyrics_romanized: bool,
    #[serde(default)]
    pub lyrics_translated: bool,
    #[serde(default = "default_lyrics_auto_romanize")]
    pub lyrics_auto_romanize: bool,
    #[serde(default = "default_lyrics_target_lang")]
    pub lyrics_target_lang: String,
    #[serde(default = "default_lyrics_font_family")]
    pub lyrics_font_family: String,
    #[serde(default = "default_lyrics_font_size")]
    pub lyrics_font_size: String,
    #[serde(default = "default_lyrics_side")]
    pub lyrics_side: String,
}

impl Default for PersistedSettings {
    fn default() -> Self {
        Self {
            version: VERSION,
            theme: "noir".to_string(),
            ambient_mode: "off".to_string(),
            art_ambient: false,
            vinyl_wobble: true,
            film_grain: true,
            lean_back_mode: true,
            cursor_hide: true,
            idle_timeout_seconds: 3,
            always_on_top: false,
            keyboard_shortcuts_enabled: true,
            quit_to_tray: true,
            start_with_windows: false,
            window_mode: "main".to_string(),
            mini_transparent_mode: false,
            lyrics_enabled: true,
            lyrics_layout: "split".to_string(),
            lyrics_romanized: false,
            lyrics_auto_romanize: true,
            lyrics_translated: false,
            lyrics_target_lang: "en".to_string(),
            lyrics_font_family: "display".to_string(),
            lyrics_font_size: "md".to_string(),
            lyrics_side: "right".to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub theme: Option<String>,
    pub ambient_mode: Option<String>,
    pub art_ambient: Option<bool>,
    pub vinyl_wobble: Option<bool>,
    pub film_grain: Option<bool>,
    pub lean_back_mode: Option<bool>,
    pub cursor_hide: Option<bool>,
    pub idle_timeout_seconds: Option<u8>,
    pub always_on_top: Option<bool>,
    pub keyboard_shortcuts_enabled: Option<bool>,
    pub quit_to_tray: Option<bool>,
    pub start_with_windows: Option<bool>,
    pub window_mode: Option<String>,
    pub mini_transparent_mode: Option<bool>,
    pub lyrics_enabled: Option<bool>,
    pub lyrics_layout: Option<String>,
    pub lyrics_romanized: Option<bool>,
    pub lyrics_translated: Option<bool>,
    pub lyrics_auto_romanize: Option<bool>,
    pub lyrics_target_lang: Option<String>,
    pub lyrics_font_family: Option<String>,
    pub lyrics_font_size: Option<String>,
    pub lyrics_side: Option<String>,
}

pub struct SettingsState {
    settings: Mutex<PersistedSettings>,
}

impl SettingsState {
    pub fn new() -> Self {
        Self {
            settings: Mutex::new(PersistedSettings::default()),
        }
    }

    pub async fn snapshot(&self) -> PersistedSettings {
        self.settings.lock().await.clone()
    }

    async fn replace(&self, settings: PersistedSettings) {
        *self.settings.lock().await = settings;
    }
}

pub async fn initialize_settings(app: AppHandle) -> Result<(), String> {
    let settings = load_settings(&app)?;
    if let Err(error) = sync_start_with_windows(&app, settings.start_with_windows) {
        eprintln!("[VinylDeck settings] Failed to restore autostart: {error}");
    }
    app.state::<SettingsState>().replace(settings.clone()).await;
    save_settings(&app, &settings)?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_settings_snapshot(
    state: State<'_, SettingsState>,
) -> Result<PersistedSettings, String> {
    Ok(state.snapshot().await)
}

#[tauri::command]
pub async fn cmd_settings_update(
    app: AppHandle,
    state: State<'_, SettingsState>,
    patch: SettingsPatch,
) -> Result<PersistedSettings, String> {
    let current = state.snapshot().await;
    let settings = apply_patch(&current, patch);
    if settings.start_with_windows != current.start_with_windows {
        sync_start_with_windows(&app, settings.start_with_windows)?;
    }
    state.replace(settings.clone()).await;
    save_settings(&app, &settings)?;
    sync_mini_transparency(&app, &settings, &current);
    emit_settings_changed(&app, &settings);
    Ok(settings)
}

#[tauri::command]
pub async fn cmd_settings_reset(
    app: AppHandle,
    state: State<'_, SettingsState>,
) -> Result<PersistedSettings, String> {
    let current = state.snapshot().await;
    let settings = PersistedSettings::default();
    sync_start_with_windows(&app, settings.start_with_windows)?;
    state.replace(settings.clone()).await;
    save_settings(&app, &settings)?;
    sync_mini_transparency(&app, &settings, &current);
    emit_settings_changed(&app, &settings);
    Ok(settings)
}

fn load_settings(app: &AppHandle) -> Result<PersistedSettings, String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    Ok(validate_settings(store.get(STORE_KEY)))
}

fn save_settings(app: &AppHandle, settings: &PersistedSettings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let value = serde_json::to_value(settings).map_err(|error| error.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|error| error.to_string())
}

fn emit_settings_changed(app: &AppHandle, settings: &PersistedSettings) {
    let _ = app.emit(SETTINGS_CHANGED_EVENT, settings);
}

/// Keeps the live Mini window's Acrylic effect in sync with the persisted
/// setting. No-op if Mini is not currently open, and only touches the OS
/// window when the value actually changed.
fn sync_mini_transparency(
    app: &AppHandle,
    settings: &PersistedSettings,
    previous: &PersistedSettings,
) {
    if settings.mini_transparent_mode == previous.mini_transparent_mode {
        return;
    }

    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        window::apply_mini_transparency(&mini, settings.mini_transparent_mode);
    }
}

fn validate_settings(value: Option<Value>) -> PersistedSettings {
    let Some(Value::Object(raw)) = value else {
        return PersistedSettings::default();
    };

    let defaults = PersistedSettings::default();
    let legacy_theme = read_string_choice(raw.get("theme"), LEGACY_THEMES)
        .unwrap_or_else(|| defaults.theme.clone());
    let theme = if SHELL_THEMES.contains(&legacy_theme.as_str()) {
        legacy_theme.clone()
    } else {
        shell_from_legacy_theme(&legacy_theme).to_string()
    };
    let art_ambient = read_bool(raw.get("artAmbient"), false);
    let ambient_mode = normalize_ambient_mode(raw.get("ambientMode"))
        .unwrap_or_else(|| ambient_from_legacy_theme(&legacy_theme, art_ambient).to_string());
    let window_mode = read_string_choice(raw.get("windowMode"), WINDOW_MODES)
        .unwrap_or_else(|| defaults.window_mode.clone());
    let lyrics_layout = read_string_choice(raw.get("lyricsLayout"), LYRICS_LAYOUTS)
        .unwrap_or_else(|| defaults.lyrics_layout.clone());
    let lyrics_target_lang =
        read_string_choice(raw.get("lyricsTargetLang"), LYRICS_TARGET_LANGS)
            .unwrap_or_else(|| defaults.lyrics_target_lang.clone());
    let lyrics_font_family =
        read_string_choice(raw.get("lyricsFontFamily"), LYRICS_FONT_FAMILIES)
            .unwrap_or_else(|| defaults.lyrics_font_family.clone());
    let lyrics_font_size =
        read_string_choice(raw.get("lyricsFontSize"), LYRICS_FONT_SIZES)
            .unwrap_or_else(|| defaults.lyrics_font_size.clone());
    let lyrics_side = read_string_choice(raw.get("lyricsSide"), LYRICS_SIDES)
        .unwrap_or_else(|| defaults.lyrics_side.clone());

    PersistedSettings {
        version: VERSION,
        theme,
        art_ambient: ambient_mode != "off",
        ambient_mode,
        vinyl_wobble: read_bool(raw.get("vinylWobble"), defaults.vinyl_wobble),
        film_grain: read_bool(raw.get("filmGrain"), defaults.film_grain),
        lean_back_mode: read_bool(raw.get("leanBackMode"), defaults.lean_back_mode),
        cursor_hide: read_bool(raw.get("cursorHide"), defaults.cursor_hide),
        idle_timeout_seconds: read_idle_timeout(raw.get("idleTimeoutSeconds")),
        always_on_top: read_bool(raw.get("alwaysOnTop"), defaults.always_on_top),
        keyboard_shortcuts_enabled: read_bool(
            raw.get("keyboardShortcutsEnabled"),
            defaults.keyboard_shortcuts_enabled,
        ),
        quit_to_tray: read_bool(raw.get("quitToTray"), defaults.quit_to_tray),
        start_with_windows: read_bool(raw.get("startWithWindows"), defaults.start_with_windows),
        window_mode,
        mini_transparent_mode: read_bool(
            raw.get("miniTransparentMode"),
            defaults.mini_transparent_mode,
        ),
        lyrics_enabled: read_bool(raw.get("lyricsEnabled"), defaults.lyrics_enabled),
        lyrics_layout,
        lyrics_romanized: read_bool(raw.get("lyricsRomanized"), defaults.lyrics_romanized),
        lyrics_auto_romanize: read_bool(raw.get("lyricsAutoRomanize"), defaults.lyrics_auto_romanize),
        lyrics_translated: read_bool(raw.get("lyricsTranslated"), defaults.lyrics_translated),
        lyrics_target_lang,
        lyrics_font_family,
        lyrics_font_size,
        lyrics_side,
    }
}

fn apply_patch(current: &PersistedSettings, patch: SettingsPatch) -> PersistedSettings {
    let mut next = current.clone();

    if let Some(theme) = patch
        .theme
        .filter(|value| SHELL_THEMES.contains(&value.as_str()))
    {
        next.theme = theme;
    }
    if let Some(mode) = patch
        .ambient_mode
        .and_then(|value| normalize_ambient_mode_string(&value))
    {
        next.ambient_mode = mode;
    } else if let Some(value) = patch.art_ambient {
        next.ambient_mode = if value { "beam" } else { "off" }.to_string();
    }
    if let Some(value) = patch.vinyl_wobble {
        next.vinyl_wobble = value;
    }
    if let Some(value) = patch.film_grain {
        next.film_grain = value;
    }
    if let Some(value) = patch.lean_back_mode {
        next.lean_back_mode = value;
    }
    if let Some(value) = patch.cursor_hide {
        next.cursor_hide = value;
    }
    if let Some(value) = patch.idle_timeout_seconds {
        next.idle_timeout_seconds = value.clamp(1, 5);
    }
    if let Some(value) = patch.always_on_top {
        next.always_on_top = value;
    }
    if let Some(value) = patch.keyboard_shortcuts_enabled {
        next.keyboard_shortcuts_enabled = value;
    }
    if let Some(value) = patch.quit_to_tray {
        next.quit_to_tray = value;
    }
    if let Some(value) = patch.start_with_windows {
        next.start_with_windows = value;
    }
    if let Some(window_mode) = patch
        .window_mode
        .filter(|value| WINDOW_MODES.contains(&value.as_str()))
    {
        if window_mode != "mini" {
            next.window_mode = window_mode;
        }
    }
    if let Some(value) = patch.mini_transparent_mode {
        next.mini_transparent_mode = value;
    }
    if let Some(value) = patch.lyrics_enabled {
        next.lyrics_enabled = value;
    }
    if let Some(layout) = patch
        .lyrics_layout
        .filter(|value| LYRICS_LAYOUTS.contains(&value.as_str()))
    {
        next.lyrics_layout = layout;
    }
    if let Some(value) = patch.lyrics_romanized {
        next.lyrics_romanized = value;
    }
    if let Some(value) = patch.lyrics_translated {
        next.lyrics_translated = value;
    }
    if let Some(value) = patch.lyrics_auto_romanize {
        next.lyrics_auto_romanize = value;
    }
    if let Some(lang) = patch
        .lyrics_target_lang
        .filter(|value| LYRICS_TARGET_LANGS.contains(&value.as_str()))
    {
        next.lyrics_target_lang = lang;
    }
    if let Some(font) = patch
        .lyrics_font_family
        .filter(|value| LYRICS_FONT_FAMILIES.contains(&value.as_str()))
    {
        next.lyrics_font_family = font;
    }
    if let Some(size) = patch
        .lyrics_font_size
        .filter(|value| LYRICS_FONT_SIZES.contains(&value.as_str()))
    {
        next.lyrics_font_size = size;
    }
    if let Some(side) = patch
        .lyrics_side
        .filter(|value| LYRICS_SIDES.contains(&value.as_str()))
    {
        next.lyrics_side = side;
    }

    next.art_ambient = next.ambient_mode != "off";
    next.version = VERSION;
    next
}

fn sync_start_with_windows(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable()
    } else {
        autostart.disable()
    }
    .map_err(|error| error.to_string())
}

fn shell_from_legacy_theme(theme: &str) -> &'static str {
    match theme {
        "glass" | "paper" => "glass",
        _ => "noir",
    }
}

fn ambient_from_legacy_theme(theme: &str, art_ambient: bool) -> &'static str {
    match theme {
        "aurora" | "vapor" => "beam",
        "noir" if art_ambient => "beam",
        _ => "off",
    }
}

fn normalize_ambient_mode(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?;
    normalize_ambient_mode_string(value)
}

fn normalize_ambient_mode_string(value: &str) -> Option<String> {
    match value {
        "off" => Some("off".to_string()),
        "beam" | "caustic" | "aurora" => Some("beam".to_string()),
        _ => None,
    }
}

fn read_string_choice(value: Option<&Value>, choices: &[&str]) -> Option<String> {
    let value = value?.as_str()?;
    choices.contains(&value).then(|| value.to_string())
}

fn read_bool(value: Option<&Value>, fallback: bool) -> bool {
    value.and_then(Value::as_bool).unwrap_or(fallback)
}

fn read_idle_timeout(value: Option<&Value>) -> u8 {
    value
        .and_then(Value::as_u64)
        .map(|value| value.clamp(1, 5) as u8)
        .unwrap_or(PersistedSettings::default().idle_timeout_seconds)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{apply_patch, validate_settings, PersistedSettings, SettingsPatch};

    #[test]
    fn validates_bad_settings_to_safe_defaults() {
        let settings = validate_settings(Some(json!({
            "version": 999,
            "theme": "bogus",
            "ambientMode": "laser",
            "artAmbient": "yes",
            "vinylWobble": "yes",
            "filmGrain": false,
            "leanBackMode": true,
            "cursorHide": false,
            "idleTimeoutSeconds": 99,
            "alwaysOnTop": true,
            "keyboardShortcutsEnabled": "no",
            "quitToTray": "no",
            "startWithWindows": "no",
            "windowMode": "bad",
            "miniTransparentMode": "no"
        })));

        assert_eq!(settings.theme, "noir");
        assert_eq!(settings.ambient_mode, "off");
        assert!(!settings.art_ambient);
        assert!(settings.vinyl_wobble);
        assert!(!settings.film_grain);
        assert_eq!(settings.idle_timeout_seconds, 5);
        assert!(settings.keyboard_shortcuts_enabled);
        assert!(settings.quit_to_tray);
        assert!(!settings.start_with_windows);
        assert_eq!(settings.window_mode, "main");
        assert!(!settings.mini_transparent_mode);
        assert_eq!(settings.version, 2);
    }

    #[test]
    fn migrates_legacy_themes_to_shell_and_ambient_modes() {
        let aurora = validate_settings(Some(json!({ "theme": "aurora" })));
        assert_eq!(aurora.theme, "noir");
        assert_eq!(aurora.ambient_mode, "beam");
        assert!(aurora.art_ambient);

        let paper = validate_settings(Some(json!({ "theme": "paper" })));
        assert_eq!(paper.theme, "glass");
        assert_eq!(paper.ambient_mode, "off");
    }

    #[test]
    fn legacy_art_ambient_maps_to_studio_beam() {
        let settings = validate_settings(Some(json!({
            "theme": "noir",
            "artAmbient": true
        })));

        assert_eq!(settings.theme, "noir");
        assert_eq!(settings.ambient_mode, "beam");
        assert!(settings.art_ambient);
    }

    #[test]
    fn patch_clamps_timeout_and_keeps_mini_out_of_persistence() {
        let current = PersistedSettings {
            window_mode: "fullscreen".to_string(),
            ..PersistedSettings::default()
        };
        let settings = apply_patch(
            &current,
            SettingsPatch {
                idle_timeout_seconds: Some(0),
                window_mode: Some("mini".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(settings.idle_timeout_seconds, 1);
        assert_eq!(settings.window_mode, "fullscreen");
    }

    #[test]
    fn patch_ambient_mode_and_legacy_art_ambient() {
        let current = PersistedSettings::default();
        let caustic = apply_patch(
            &current,
            SettingsPatch {
                ambient_mode: Some("caustic".to_string()),
                ..SettingsPatch::default()
            },
        );
        let off = apply_patch(
            &caustic,
            SettingsPatch {
                art_ambient: Some(false),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(caustic.ambient_mode, "beam");
        assert!(caustic.art_ambient);
        assert_eq!(off.ambient_mode, "off");
        assert!(!off.art_ambient);
    }

    #[test]
    fn reopen_persists_only_main_or_fullscreen_window_modes() {
        let current = PersistedSettings::default();
        let fullscreen = apply_patch(
            &current,
            SettingsPatch {
                window_mode: Some("fullscreen".to_string()),
                ..SettingsPatch::default()
            },
        );
        let mini_attempt = apply_patch(
            &fullscreen,
            SettingsPatch {
                window_mode: Some("mini".to_string()),
                ..SettingsPatch::default()
            },
        );
        let main = apply_patch(
            &mini_attempt,
            SettingsPatch {
                window_mode: Some("main".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(fullscreen.window_mode, "fullscreen");
        assert_eq!(mini_attempt.window_mode, "fullscreen");
        assert_eq!(main.window_mode, "main");
    }

    #[test]
    fn patch_interaction_toggles() {
        let current = PersistedSettings::default();
        let settings = apply_patch(
            &current,
            SettingsPatch {
                keyboard_shortcuts_enabled: Some(false),
                quit_to_tray: Some(false),
                start_with_windows: Some(true),
                ..SettingsPatch::default()
            },
        );

        assert!(!settings.keyboard_shortcuts_enabled);
        assert!(!settings.quit_to_tray);
        assert!(settings.start_with_windows);
    }

    #[test]
    fn patch_toggles_mini_transparent_mode() {
        let current = PersistedSettings::default();
        assert!(!current.mini_transparent_mode);

        let settings = apply_patch(
            &current,
            SettingsPatch {
                mini_transparent_mode: Some(true),
                ..SettingsPatch::default()
            },
        );

        assert!(settings.mini_transparent_mode);
    }

    #[test]
    fn validates_and_patches_lyrics_settings() {
        let fallback = validate_settings(Some(json!({
            "lyricsEnabled": "invalid",
            "lyricsLayout": "overlay",
            "lyricsRomanized": "yes",
            "lyricsTranslated": "no",
            "lyricsTargetLang": "xx"
        })));
        assert!(fallback.lyrics_enabled);
        assert_eq!(fallback.lyrics_layout, "split");
        assert!(!fallback.lyrics_romanized);
        assert!(!fallback.lyrics_translated);
        assert_eq!(fallback.lyrics_target_lang, "en");

        let patched = apply_patch(
            &fallback,
            SettingsPatch {
                lyrics_enabled: Some(false),
                lyrics_layout: Some("strip".to_string()),
                lyrics_romanized: Some(true),
                lyrics_translated: Some(true),
                lyrics_target_lang: Some("ja".to_string()),
                ..SettingsPatch::default()
            },
        );
        assert!(!patched.lyrics_enabled);
        assert_eq!(patched.lyrics_layout, "strip");
        assert!(patched.lyrics_romanized);
        assert!(patched.lyrics_translated);
        assert_eq!(patched.lyrics_target_lang, "ja");
    }
}
