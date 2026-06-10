# PRD-03 — VinylDeck: Windows Desktop App (Tauri v2)

**Version:** 1.0  
**Date:** 2026-06-08  
**Depends on:** PRD-01, PRD-02  
**Platform:** Windows 10 v1903+ / Windows 11

---

## 1. Purpose

This document specifies the Tauri v2 desktop application shell for Windows: project setup, the Rust backend that reads from SMTC, the window management system, system tray, settings persistence, and keyboard shortcuts. The Visual Engine (PRD-02) runs inside the Tauri WebView2 window.

---

## 2. Prerequisites / Environment

```
Rust:          1.79+ (stable channel)
Node.js:       20+ LTS
npm:           10+
Tauri CLI:     2.x  (cargo install tauri-cli --version "^2")
Windows SDK:   10.0.19041+ (for WinRT APIs)
WebView2:      Ships with Windows 11. On Windows 10: Tauri installer handles it.
```

---

## 3. Project Initialization

```bash
# Create new Tauri + React + TypeScript project
npm create tauri-app@latest vinyldeck -- \
  --template react-ts \
  --manager npm

cd vinyldeck

# Frontend deps
npm install motion zustand @vibrant/core

# Tauri plugin for settings persistence
npm install @tauri-apps/plugin-store

cargo add tauri-plugin-store --manifest-path src-tauri/Cargo.toml
```

### 3.1 Cargo.toml Dependencies

```toml
# src-tauri/Cargo.toml

[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt", "sync", "macros"] }
base64 = "0.22"
image = "0.25"

# Windows-specific WinRT bindings for SMTC
[target.'cfg(windows)'.dependencies]
windows = { version = "0.56", features = [
  "Media_Control",
  "Storage_Streams",
  "Foundation",
  "Foundation_Collections",
  "Graphics_Imaging",
  "Media",
  "Media_MediaProperties",
] }
```

### 3.2 tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "VinylDeck",
  "version": "0.1.0",
  "identifier": "com.vinyldeck.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "VinylDeck",
        "width": 900,
        "height": 560,
        "minWidth": 700,
        "minHeight": 440,
        "decorations": true,
        "transparent": false,
        "resizable": true,
        "center": true,
        "visible": true
      }
    ],
    "trayIcon": {
      "id": "tray",
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true,
      "menuOnLeftClick": false
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"]
  }
}
```

### 3.3 Capabilities File

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window capabilities",
  "windows": ["main", "mini"],
  "permissions": [
    "core:default",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-fullscreen",
    "core:window:allow-set-decorations",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-set-resizable",
    "core:window:allow-set-title",
    "core:event:allow-listen",
    "core:event:allow-emit",
    "store:default"
  ]
}
```

---

## 4. Rust Backend — SMTC Integration

### 4.1 File: `src-tauri/src/media/smtc.rs`

This is the most important Rust file. It reads media sessions from other applications via the Windows Runtime SMTC API.

```rust
// src-tauri/src/media/smtc.rs

use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::{DataReader, IRandomAccessStreamReference};
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaSnapshot {
    pub track: String,
    pub artist: String,
    pub album: String,
    pub artwork_data_url: Option<String>,   // "data:image/png;base64,..."
    pub duration_secs: f64,                  // 0.0 if unknown
    pub position_secs: f64,                  // 0.0 if unknown
    pub is_playing: bool,
    pub source_name: String,                 // App display name, e.g. "Spotify.exe" → "Spotify"
    pub source_id: String,                   // Session ID for tracking changes
    pub can_play: bool,
    pub can_pause: bool,
    pub can_skip_next: bool,
    pub can_skip_prev: bool,
    pub can_seek: bool,
}

impl Default for MediaSnapshot {
    fn default() -> Self {
        Self {
            track: String::new(),
            artist: String::new(),
            album: String::new(),
            artwork_data_url: None,
            duration_secs: 0.0,
            position_secs: 0.0,
            is_playing: false,
            source_name: String::new(),
            source_id: String::new(),
            can_play: false,
            can_pause: false,
            can_skip_next: false,
            can_skip_prev: false,
            can_seek: false,
        }
    }
}

pub async fn get_current_media() -> anyhow::Result<Option<MediaSnapshot>> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    build_snapshot(&session).await.map(Some)
}

async fn build_snapshot(
    session: &GlobalSystemMediaTransportControlsSession,
) -> anyhow::Result<MediaSnapshot> {
    let mut snapshot = MediaSnapshot::default();

    // Source identifier
    snapshot.source_id = session.SourceAppUserModelId()
        .unwrap_or_default()
        .to_string();
    snapshot.source_name = friendly_source_name(&snapshot.source_id);

    // Playback info
    if let Ok(playback_info) = session.GetPlaybackInfo() {
        let status = playback_info.PlaybackStatus()
            .unwrap_or(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped);
        snapshot.is_playing = status ==
            GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

        if let Ok(controls) = playback_info.Controls() {
            snapshot.can_play = controls.IsPlayEnabled().unwrap_or(false);
            snapshot.can_pause = controls.IsPauseEnabled().unwrap_or(false);
            snapshot.can_skip_next = controls.IsNextEnabled().unwrap_or(false);
            snapshot.can_skip_prev = controls.IsPreviousEnabled().unwrap_or(false);
            // Seek is available if Fast Forward/Rewind/ChangePlaybackPosition is enabled
            snapshot.can_seek = controls.IsPlaybackPositionEnabled().unwrap_or(false)
                || controls.IsFastForwardEnabled().unwrap_or(false);
        }
    }

    // Timeline (position + duration)
    if let Ok(timeline) = session.GetTimelineProperties() {
        let duration = timeline.EndTime().unwrap_or_default();
        let position = timeline.Position().unwrap_or_default();
        // Windows stores these as TimeSpan (100-nanosecond intervals)
        snapshot.duration_secs = duration.Duration as f64 / 10_000_000.0;
        snapshot.position_secs = position.Duration as f64 / 10_000_000.0;
    }

    // Media properties (track, artist, album, artwork)
    if let Ok(props) = session.TryGetMediaPropertiesAsync()?.await {
        snapshot.track = props.Title().unwrap_or_default().to_string();
        snapshot.artist = props.Artist().unwrap_or_default().to_string();
        snapshot.album = props.AlbumTitle().unwrap_or_default().to_string();

        // Artwork: convert the stream reference to base64 PNG
        if let Ok(thumb_ref) = props.Thumbnail() {
            snapshot.artwork_data_url = artwork_to_data_url(thumb_ref).await.ok();
        }
    }

    Ok(snapshot)
}

async fn artwork_to_data_url(
    thumb_ref: IRandomAccessStreamReference
) -> anyhow::Result<String> {
    let stream = thumb_ref.OpenReadAsync()?.await?;
    let size = stream.Size()? as u32;

    if size == 0 || size > 5 * 1024 * 1024 {
        // Skip if empty or suspiciously large (> 5MB)
        return Err(anyhow::anyhow!("Invalid artwork size"));
    }

    let reader = DataReader::CreateDataReader(&stream)?;
    reader.LoadAsync(size)?.await?;

    let mut buffer = vec![0u8; size as usize];
    reader.ReadBytes(&mut buffer)?;

    // Determine content type (peek at magic bytes)
    let mime = if buffer.starts_with(&[0xFF, 0xD8]) {
        "image/jpeg"
    } else if buffer.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "image/png"
    } else {
        "image/jpeg"  // safe default
    };

    let b64 = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn friendly_source_name(app_id: &str) -> String {
    // Map known App User Model IDs to friendly names
    let lower = app_id.to_lowercase();
    if lower.contains("spotify") { return "Spotify".to_string(); }
    if lower.contains("chrome") { return "Chrome".to_string(); }
    if lower.contains("msedge") || lower.contains("edge") { return "Edge".to_string(); }
    if lower.contains("firefox") { return "Firefox".to_string(); }
    if lower.contains("vlc") { return "VLC".to_string(); }
    if lower.contains("aimp") { return "AIMP".to_string(); }
    if lower.contains("foobar") { return "foobar2000".to_string(); }
    if lower.contains("tidal") { return "Tidal".to_string(); }
    if lower.contains("youtube") { return "YouTube Music".to_string(); }
    if lower.contains("applemusicwin") { return "Apple Music".to_string(); }
    if lower.contains("groove") { return "Groove Music".to_string(); }
    if lower.contains("plex") { return "Plex".to_string(); }
    // Fallback: strip .exe and title-case
    app_id
        .split('\\').last().unwrap_or(app_id)
        .trim_end_matches(".exe")
        .to_string()
}

// Playback control commands
pub async fn send_play(session: &GlobalSystemMediaTransportControlsSession) -> anyhow::Result<()> {
    session.TryPlayAsync()?.await?;
    Ok(())
}

pub async fn send_pause(session: &GlobalSystemMediaTransportControlsSession) -> anyhow::Result<()> {
    session.TryPauseAsync()?.await?;
    Ok(())
}

pub async fn send_toggle(session: &GlobalSystemMediaTransportControlsSession) -> anyhow::Result<()> {
    session.TryTogglePlayPauseAsync()?.await?;
    Ok(())
}

pub async fn send_next(session: &GlobalSystemMediaTransportControlsSession) -> anyhow::Result<()> {
    session.TrySkipNextAsync()?.await?;
    Ok(())
}

pub async fn send_prev(session: &GlobalSystemMediaTransportControlsSession) -> anyhow::Result<()> {
    session.TrySkipPreviousAsync()?.await?;
    Ok(())
}

pub async fn send_seek(
    session: &GlobalSystemMediaTransportControlsSession,
    position_secs: f64,
) -> anyhow::Result<()> {
    use windows::Foundation::TimeSpan;
    let ticks = (position_secs * 10_000_000.0) as i64;
    session.TryChangePlaybackPositionAsync(ticks)?.await?;
    Ok(())
}
```

### 4.2 File: `src-tauri/src/media/mod.rs` — Polling Loop

SMTC doesn't reliably push events to non-UWP/Win32 apps via WinRT event handlers. The safe, portable approach is **polling** on a background thread and emitting events to the frontend only when state changes.

```rust
// src-tauri/src/media/mod.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, interval};
use tauri::{AppHandle, Emitter};
use super::smtc::{MediaSnapshot, get_current_media};

pub mod smtc;
pub mod commands;

// Polling interval: 500ms is responsive enough without hammering the OS
// For most use cases this is fine. Users won't notice 500ms delay on track change.
const POLL_INTERVAL_MS: u64 = 500;

// Key that identifies a "different" state requiring a frontend event:
// Track the last emitted snapshot's key fields to avoid redundant events
#[derive(Debug, Clone, PartialEq)]
struct SnapshotKey {
    track: String,
    is_playing: bool,
    source_id: String,
    position_bucket: u32,  // position rounded to nearest 5s to avoid constant events
}

impl From<&MediaSnapshot> for SnapshotKey {
    fn from(s: &MediaSnapshot) -> Self {
        Self {
            track: s.track.clone(),
            is_playing: s.is_playing,
            source_id: s.source_id.clone(),
            position_bucket: (s.position_secs / 5.0) as u32,
        }
    }
}

pub fn start_media_polling(app: AppHandle) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_millis(POLL_INTERVAL_MS));
        let mut last_key: Option<SnapshotKey> = None;
        let mut last_snapshot: Option<MediaSnapshot> = None;

        loop {
            ticker.tick().await;

            match get_current_media().await {
                Ok(Some(snapshot)) => {
                    let key = SnapshotKey::from(&snapshot);
                    let is_new = last_key.as_ref().map(|k| k != &key).unwrap_or(true);

                    if is_new {
                        // Emit the full snapshot to the frontend
                        let _ = app.emit("media-state-changed", &snapshot);
                        last_key = Some(key);
                        last_snapshot = Some(snapshot);
                    }
                }
                Ok(None) => {
                    // No active session
                    if last_snapshot.is_some() {
                        let _ = app.emit("media-session-ended", ());
                        last_key = None;
                        last_snapshot = None;
                    }
                }
                Err(e) => {
                    // Log but don't crash
                    eprintln!("[SMTC] Poll error: {e}");
                }
            }
        }
    });
}
```

**On the polling approach:** Some developers prefer WinRT event subscriptions (`.add_PlaybackInfoChanged(handler)`). In Rust, subscribing to WinRT events from a background thread has threading complications (the WinRT event system expects an STA COM apartment). Polling at 500ms is simpler, reliable, and plenty responsive for this use case. Do not over-engineer this.

### 4.3 File: `src-tauri/src/media/commands.rs` — Tauri Commands

```rust
// src-tauri/src/media/commands.rs
// These are the Tauri commands callable from the frontend via invoke()

use tauri::State;
use super::smtc::*;

// Shared state: current session reference
pub struct SessionState(pub tokio::sync::Mutex<Option<()>>);
// Note: We don't store the session object because it's not Send+Sync safely.
// Instead, commands call get_current_media() each time (lightweight WinRT call).

#[tauri::command]
pub async fn cmd_play() -> Result<(), String> {
    let manager = windows::Media::Control::
        GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    let session = manager.GetCurrentSession().map_err(|e| e.to_string())?;
    send_play(&session).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_pause() -> Result<(), String> {
    // Same pattern: get manager → get session → send_pause
    todo!()
}

#[tauri::command]
pub async fn cmd_toggle_play_pause() -> Result<(), String> { todo!() }

#[tauri::command]
pub async fn cmd_next() -> Result<(), String> { todo!() }

#[tauri::command]
pub async fn cmd_previous() -> Result<(), String> { todo!() }

#[tauri::command]
pub async fn cmd_seek(position_secs: f64) -> Result<(), String> { todo!() }

#[tauri::command]
pub async fn cmd_get_media_snapshot() -> Result<Option<MediaSnapshot>, String> {
    get_current_media().await.map_err(|e| e.to_string())
}
```

### 4.4 File: `src-tauri/src/main.rs`

```rust
// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;
mod window;
mod tray;

use media::commands::*;
use media::start_media_polling;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            cmd_play,
            cmd_pause,
            cmd_toggle_play_pause,
            cmd_next,
            cmd_previous,
            cmd_seek,
            cmd_get_media_snapshot,
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
        ])
        .setup(|app| {
            // Start media polling on background thread
            start_media_polling(app.handle().clone());

            // Set up system tray
            tray::setup_tray(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VinylDeck");
}
```

---

## 5. Frontend — Tauri Source Adapter

This bridges Tauri events to the `PlaybackSource` interface defined in PRD-01.

```typescript
// src/lib/playback/tauriSource.ts

import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { PlaybackState, PlaybackSource } from "./types";

// Type mirroring the Rust MediaSnapshot
interface RustMediaSnapshot {
  track: string;
  artist: string;
  album: string;
  artwork_data_url: string | null;
  duration_secs: number;
  position_secs: number;
  is_playing: boolean;
  source_name: string;
  source_id: string;
  can_play: boolean;
  can_pause: boolean;
  can_skip_next: boolean;
  can_skip_prev: boolean;
  can_seek: boolean;
}

function snapshotToState(s: RustMediaSnapshot): PlaybackState {
  return {
    track: s.track || "Unknown Track",
    artist: s.artist || "Unknown Artist",
    album: s.album || "",
    artworkDataUrl: s.artwork_data_url,
    duration: s.duration_secs,
    position: s.position_secs,
    isPlaying: s.is_playing,
    sourceName: s.source_name,
    sourceId: s.source_id,
    canSeek: s.can_seek,
    canSkip: s.can_skip_next,
    canControl: s.can_play || s.can_pause,
  };
}

export function createTauriSource(): PlaybackSource {
  let currentState: PlaybackState = defaultState();
  const listeners = new Set<(state: PlaybackState) => void>();

  function defaultState(): PlaybackState {
    return {
      track: "", artist: "", album: "",
      artworkDataUrl: null,
      duration: 0, position: 0,
      isPlaying: false,
      sourceName: "", sourceId: "",
      canSeek: false, canSkip: false, canControl: false,
    };
  }

  function notify(state: PlaybackState) {
    currentState = state;
    listeners.forEach(fn => fn(state));
  }

  return {
    getState: () => currentState,

    async start() {
      // 1. Get initial state immediately
      try {
        const snapshot = await invoke<RustMediaSnapshot | null>("cmd_get_media_snapshot");
        if (snapshot) notify(snapshotToState(snapshot));
      } catch (e) {
        console.warn("[TauriSource] Initial fetch failed:", e);
      }

      // 2. Listen for ongoing updates
      await listen<RustMediaSnapshot>("media-state-changed", ({ payload }) => {
        notify(snapshotToState(payload));
      });

      await listen("media-session-ended", () => {
        notify(defaultState());
      });
    },

    stop() { /* Tauri listeners are removed when component unmounts */ },

    onStateChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    play()              { invoke("cmd_play").catch(console.warn); },
    pause()             { invoke("cmd_pause").catch(console.warn); },
    togglePlayPause()   { invoke("cmd_toggle_play_pause").catch(console.warn); },
    next()              { invoke("cmd_next").catch(console.warn); },
    previous()          { invoke("cmd_previous").catch(console.warn); },
    seekTo(s)           { invoke("cmd_seek", { positionSecs: s }).catch(console.warn); },
  };
}
```

---

## 6. Zustand Store

The single source of truth for the entire app.

```typescript
// src/lib/playback/store.ts

import { create } from "zustand";
import type { PlaybackState } from "./types";
import type { ThemeId } from "../themes/applier";
import type { WindowMode } from "../types";

interface VinylDeckStore {
  // Playback
  playback: PlaybackState;
  lastSyncTime: number;            // Date.now() when position was last received from OS
  setPlayback: (state: PlaybackState) => void;

  // Computed: position extrapolated from lastSyncTime
  getPosition: () => number;

  // Theme
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;

  // Window
  windowMode: WindowMode;          // "main" | "fullscreen" | "mini"
  setWindowMode: (mode: WindowMode) => void;

  // Settings
  alwaysOnTop: boolean;
  setAlwaysOnTop: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  reduceBlur: boolean;
  setReduceBlur: (v: boolean) => void;
}

export const useVinylDeckStore = create<VinylDeckStore>((set, get) => ({
  playback: {
    track: "", artist: "", album: "", artworkDataUrl: null,
    duration: 0, position: 0, isPlaying: false,
    sourceName: "", sourceId: "", canSeek: false, canSkip: false, canControl: false,
  },
  lastSyncTime: Date.now(),
  setPlayback: (state) => set({ playback: state, lastSyncTime: Date.now() }),

  getPosition: () => {
    const { playback, lastSyncTime } = get();
    if (!playback.isPlaying) return playback.position;
    const elapsed = (Date.now() - lastSyncTime) / 1000;
    return Math.min(playback.position + elapsed, playback.duration || Infinity);
  },

  theme: "noir",
  setTheme: (theme) => {
    set({ theme });
    import("../themes/applier").then(({ applyTheme }) => applyTheme(theme));
  },

  windowMode: "main",
  setWindowMode: (mode) => set({ windowMode: mode }),

  alwaysOnTop: false,
  setAlwaysOnTop: (v) => set({ alwaysOnTop: v }),

  reduceMotion: false,
  setReduceMotion: (v) => set({ reduceMotion: v }),

  reduceBlur: false,
  setReduceBlur: (v) => set({ reduceBlur: v }),
}));
```

---

## 7. Window Management

### 7.1 Window Modes

There are three window modes. Mode switching happens via Tauri commands from the frontend.

| Mode | Description | Tauri Window Label |
|---|---|---|
| `main` | Primary app window, standard chrome, resizable | `main` |
| `fullscreen` | Borderless, fullscreen, no taskbar | `main` (set fullscreen) |
| `mini` | Small 280×280 always-on-top frameless window | `mini` |

### 7.2 Rust Window Commands

```rust
// src-tauri/src/window/mod.rs

use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};

#[tauri::command]
pub async fn cmd_set_always_on_top(
    app: AppHandle,
    enabled: bool,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    if let Some(window) = app.get_webview_window("mini") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cmd_set_window_mode(
    app: AppHandle,
    mode: String,
) -> Result<(), String> {
    match mode.as_str() {
        "main" => {
            // Show main window, hide mini
            if let Some(w) = app.get_webview_window("mini") { let _ = w.hide(); }
            if let Some(w) = app.get_webview_window("main") {
                w.set_fullscreen(false).ok();
                w.set_decorations(true).ok();
                w.show().map_err(|e| e.to_string())?;
                w.set_focus().ok();
            }
        }
        "fullscreen" => {
            if let Some(w) = app.get_webview_window("mini") { let _ = w.hide(); }
            if let Some(w) = app.get_webview_window("main") {
                w.set_decorations(false).ok();
                w.set_fullscreen(true).map_err(|e| e.to_string())?;
                w.show().ok();
                w.set_focus().ok();
            }
        }
        "mini" => {
            if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); }
            // Create mini window if it doesn't exist
            if app.get_webview_window("mini").is_none() {
                WebviewWindowBuilder::new(
                    &app,
                    "mini",
                    WebviewUrl::App("index.html".into()),
                )
                .title("VinylDeck Mini")
                .inner_size(280.0, 280.0)
                .always_on_top(true)
                .decorations(false)
                .resizable(false)
                .skip_taskbar(true)
                .build()
                .map_err(|e| e.to_string())?;
            } else if let Some(w) = app.get_webview_window("mini") {
                w.show().ok();
                w.set_focus().ok();
            }
        }
        _ => return Err(format!("Unknown mode: {mode}")),
    }
    Ok(())
}
```

### 7.3 Frontend: Detecting Window Mode

The frontend detects which window it's in via a query parameter or Tauri's window label:

```typescript
// src/lib/windowMode.ts

import { getCurrentWindow } from "@tauri-apps/api/window";

export async function getCurrentWindowMode(): Promise<"main" | "mini"> {
  const win = getCurrentWindow();
  return win.label === "mini" ? "mini" : "main";
}
```

In `App.tsx`, render `<MiniView />` if label is "mini", otherwise render `<MainView />`.

---

## 8. System Tray

```rust
// src-tauri/src/tray.rs

use tauri::{
    App,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem, PredefinedMenuItem},
    Manager,
};

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Quit VinylDeck", true, None::<&str>)?;
    let show_main = MenuItem::with_id(app, "show_main", "Open VinylDeck", true, None::<&str>)?;
    let show_mini = MenuItem::with_id(app, "show_mini", "Mini Player", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&show_main, &show_mini, &separator, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("VinylDeck")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => app.exit(0),
                "show_main" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "show_mini" => {
                    // Trigger mini mode via Tauri command
                    // (or directly call the window creation logic)
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click on tray: show/focus the current active window
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.set_focus();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

---

## 9. Keyboard Shortcuts

All keyboard shortcuts are handled in the **frontend** (React), not in Tauri's global shortcut system. Global shortcuts (system-wide hotkeys) are a Phase 2+ feature.

### 9.1 In-App Shortcuts

These work when the VinylDeck window is focused:

| Shortcut | Action |
|---|---|
| `Space` | Toggle play/pause |
| `→` | Next track |
| `←` | Previous track |
| `F` | Toggle fullscreen |
| `M` | Toggle mini player |
| `T` | Cycle through themes |
| `Escape` | Exit fullscreen (if in fullscreen) |
| `Ctrl+Q` | Quit |

### 9.2 Implementation

```typescript
// src/hooks/useKeyboardShortcuts.ts

import { useEffect } from "react";
import { useVinylDeckStore } from "../lib/playback/store";
import type { PlaybackSource } from "../lib/playback/types";

export function useKeyboardShortcuts(source: PlaybackSource) {
  const { setWindowMode, windowMode, theme, setTheme } = useVinylDeckStore();
  const THEMES = ["noir", "glass", "aurora", "vapor", "paper"] as const;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't fire when typing in an input
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          source.togglePlayPause();
          break;
        case "ArrowRight":
          if (!e.shiftKey) { e.preventDefault(); source.next(); }
          break;
        case "ArrowLeft":
          if (!e.shiftKey) { e.preventDefault(); source.previous(); }
          break;
        case "KeyF":
          setWindowMode(windowMode === "fullscreen" ? "main" : "fullscreen");
          break;
        case "KeyM":
          setWindowMode(windowMode === "mini" ? "main" : "mini");
          break;
        case "KeyT":
          const idx = THEMES.indexOf(theme);
          setTheme(THEMES[(idx + 1) % THEMES.length]);
          break;
        case "Escape":
          if (windowMode === "fullscreen") setWindowMode("main");
          break;
        case "KeyQ":
          if (e.ctrlKey) window.close();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [source, windowMode, theme]);
}
```

---

## 10. Settings Persistence

```typescript
// src/lib/settings.ts

import { Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "settings.json";
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(STORE_FILE, { autoSave: false });
  }
  return store;
}

export interface AppSettings {
  theme: string;
  windowMode: string;
  alwaysOnTop: boolean;
  reduceMotion: boolean;
  reduceBlur: boolean;
  miniLayout: "square" | "horizontal";
}

const DEFAULTS: AppSettings = {
  theme: "noir",
  windowMode: "main",
  alwaysOnTop: false,
  reduceMotion: false,
  reduceBlur: false,
  miniLayout: "square",
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = await getStore();
    const saved: Partial<AppSettings> = {};
    for (const key of Object.keys(DEFAULTS) as (keyof AppSettings)[]) {
      const val = await s.get<AppSettings[typeof key]>(key);
      if (val !== undefined) (saved as Record<string, unknown>)[key] = val;
    }
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

// Debounced save — call this after any setting change
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const s = await getStore();
      for (const [key, val] of Object.entries(settings)) {
        await s.set(key, val);
      }
      await s.save();
    } catch (e) {
      console.warn("[Settings] Save failed:", e);
    }
  }, 500);
}
```

---

## 11. Development Mode: MockSource

When developing the visual engine, use `MockSource` so you don't need real media playing.

```typescript
// src/lib/playback/mockSource.ts

import type { PlaybackSource, PlaybackState } from "./types";

const MOCK_TRACKS = [
  {
    track: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    artworkDataUrl: null,   // or a local test image URL
    duration: 354,
  },
  {
    track: "Dark Side of the Moon",
    artist: "Pink Floyd",
    album: "The Dark Side of the Moon",
    artworkDataUrl: null,
    duration: 420,
  },
];

export function createMockSource(): PlaybackSource {
  let trackIdx = 0;
  let isPlaying = false;
  let position = 0;
  let positionTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(state: PlaybackState) => void>();

  function currentState(): PlaybackState {
    const t = MOCK_TRACKS[trackIdx];
    return {
      ...t,
      position,
      isPlaying,
      sourceName: "Mock Player",
      sourceId: "mock",
      canSeek: true,
      canSkip: true,
      canControl: true,
    };
  }

  function notify() {
    const state = currentState();
    listeners.forEach(fn => fn(state));
  }

  return {
    getState: currentState,

    async start() {
      // Auto-play immediately in dev mode
      isPlaying = true;
      positionTimer = setInterval(() => {
        if (isPlaying) {
          position += 0.5;
          if (position > MOCK_TRACKS[trackIdx].duration) position = 0;
          notify();
        }
      }, 500);
      notify();
    },

    stop() {
      if (positionTimer) clearInterval(positionTimer);
    },

    onStateChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    play()   { isPlaying = true;  notify(); },
    pause()  { isPlaying = false; notify(); },
    togglePlayPause() { isPlaying = !isPlaying; notify(); },
    next()   { trackIdx = (trackIdx + 1) % MOCK_TRACKS.length; position = 0; notify(); },
    previous() { trackIdx = (trackIdx - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length; position = 0; notify(); },
    seekTo(s) { position = s; notify(); },
  };
}

// In App.tsx:
// const isDev = import.meta.env.DEV;
// const source = isDev ? createMockSource() : createTauriSource();
```

---

## 12. App Entry Point

```typescript
// src/App.tsx

import { useEffect, useState } from "react";
import { createTauriSource } from "./lib/playback/tauriSource";
import { createMockSource }  from "./lib/playback/mockSource";
import { useVinylDeckStore }  from "./lib/playback/store";
import { loadSettings, saveSettings } from "./lib/settings";
import { applyTheme } from "./lib/themes/applier";
import { getCurrentWindowMode } from "./lib/windowMode";
import { MainView }       from "./views/MainView";
import { MiniView }       from "./views/MiniView";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

const source = import.meta.env.DEV ? createMockSource() : createTauriSource();

export function App() {
  const [windowMode, setWindowModeLocal] = useState<"main" | "mini">("main");
  const { setPlayback, setTheme } = useVinylDeckStore();

  useEffect(() => {
    // 1. Detect window label
    getCurrentWindowMode().then(mode => setWindowModeLocal(mode));

    // 2. Load and apply persisted settings
    loadSettings().then(settings => {
      setTheme(settings.theme as any);
      applyTheme(settings.theme as any);
    });

    // 3. Start media source
    source.start();

    // 4. Subscribe to state changes → update Zustand store
    const unsub = source.onStateChange(state => setPlayback(state));

    return () => {
      unsub();
      source.stop();
    };
  }, []);

  useKeyboardShortcuts(source);

  if (windowMode === "mini") return <MiniView source={source} />;
  return <MainView source={source} />;
}
```

---

## 13. Empty State (No Media Playing)

When no SMTC session is active (nothing is playing on the system):

- Vinyl disc is visible but not spinning
- Needle arm is in lifted position
- Ambient layer shows default theme colors (no album art extraction)
- Track info shows: "Nothing Playing" / "Open any music app to start"
- Source badge: hidden
- Controls: all disabled (50% opacity)

This state should feel calm, not broken. The app is waiting, not erroring.

---

## 14. Build & Distribution

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   - .msi installer (Windows)
#   - .exe standalone

# The .msi handles WebView2 installation for users who don't have it.
# tauri.conf.json: "bundle.windows.webviewInstallMode": "downloadBootstrapper"
```

Add to `tauri.conf.json` under `bundle`:
```json
"windows": {
  "webviewInstallMode": {
    "type": "downloadBootstrapper"
  }
}
```

This ensures Windows 10 users who don't have WebView2 get it automatically during install.
