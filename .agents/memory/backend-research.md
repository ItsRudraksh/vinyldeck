# VinylDeck Windows Backend Research Synthesis

**Date:** 2026-06-10  
**Purpose:** Preserve verified backend/Tauri/SMTC findings so future sessions do not repeat research or implement stale PRD snippets.

## Research Rule

Use this document before web search. Treat findings below as current project guidance.

Do not repeat web research for these topics. Search only when:

- An actual compile/runtime error contradicts this document.
- A required API is absent from installed local package/crate sources.
- A genuinely new backend concept is introduced.

When a new search is necessary, prefer official Tauri documentation, Microsoft Learn, and installed crate/package sources.

---

## Verified Environment

- Windows interactive desktop session.
- Node.js: `v24.12.0`
- npm: `11.6.2`
- Rust: `1.96.0`
- Cargo: `1.96.0`
- Tauri CLI: `2.11.2`
- Tauri Rust crate resolved: `2.11.2`
- `@tauri-apps/plugin-store`: `2.4.3`
- Direct `windows` crate: `0.56`
- Existing `cargo check --manifest-path src-tauri/Cargo.toml`: passes.

## Locked Project Decisions

- Windows media integration uses direct Rust `windows` crate SMTC bindings.
- Media polling interval remains 500ms.
- Visual engine communicates only through locked `PlaybackSource` / `PlaybackState`.
- Browser development uses `MockSource`.
- Tauri development and production use real `TauriSource`.
- Current `windows = 0.56` remains pinned unless a verified blocker requires upgrade.
- Main Phase 1 window keeps native Windows decorations.
- Fullscreen and Mini modes are frameless.
- Close hides to tray; explicit Quit terminates.
- Focused-window shortcuts only. System-global hotkeys are out of scope.

---

## Tauri v2 Findings

### Runtime Detection

Use:

```ts
import { isTauri } from "@tauri-apps/api/core";
```

Do not use `import.meta.env.DEV` for source selection. `tauri dev` is development mode but must exercise real SMTC.

Recommended selection:

```ts
const forceMock = import.meta.env.VITE_FORCE_MOCK_SOURCE === "true";
const source = isTauri() && !forceMock ? createTauriSource() : createMockSource();
```

Installed local API confirms `isTauri(): boolean` exists in `@tauri-apps/api/core`.

### Store Plugin

Rust plugin registration:

```rust
.plugin(tauri_plugin_store::Builder::new().build())
```

Frontend API supports:

```ts
import { load } from "@tauri-apps/plugin-store";

const store = await load("settings.json", { autoSave: false });
await store.set("key", value);
await store.save();
```

Store path is relative to app data directory. Validate and merge loaded data with defaults. Persist only stable settings, never playback/runtime QA state.

### Capabilities and Permissions

Tauri v2 frontend API access is capability-gated. Add only required window/event/store permissions and include both `main` and `mini` window labels.

Windows `globalMediaControl` is a Windows package capability, not a Tauri ACL permission. Test SMTC separately in:

1. `npm run tauri dev`
2. Installed release bundle

### Event Listener Cleanup

Tauri event `listen()` returns an unlisten function. `TauriSource` must retain and call all unlisten functions in `stop()`.

Bad:

```ts
await listen("event", handler);
stop() {}
```

Required:

```ts
const unlisten = await listen("event", handler);
unlisteners.push(unlisten);

stop() {
  for (const unlisten of unlisteners.splice(0)) unlisten();
}
```

This prevents duplicate listeners during source swaps, HMR, or multi-window lifecycle changes.

### Close and Tray Lifecycle

Tauri v2 close is a close-request flow. Implement close-to-tray carefully:

- Main/mini close request hides window.
- Explicit tray Quit exits process.
- Avoid recursively calling close while intercepting close.
- Tray left click shows/focuses main.
- Reuse one window-mode service for tray and frontend commands.

### Window Modes

Recommended:

- `main`: existing native-decorated main window.
- `fullscreen`: same main window, fullscreen, mini hidden.
- `mini`: separate `280×280`, always-on-top, frameless, non-resizable, skip taskbar; main hidden.

Do not create duplicate Mini windows. Reuse existing label.

Installed Tauri 2.11.2 source warning: `WebviewWindowBuilder::new(...).build()` has a known Windows/WebView2 deadlock risk when used in synchronous commands or event handlers. If mini creation opens a blank/white window or hangs, convert the window-mode command path to an async command or spawn creation off the sync command path before trying visual/CSS fixes.

### Windows Installer

Tauri supports:

```json
"bundle": {
  "windows": {
    "webviewInstallMode": {
      "type": "downloadBootstrapper"
    }
  }
}
```

This keeps installer small and downloads WebView2 when needed. Validate installer on the actual target environment.

---

## Microsoft SMTC Findings

### Session Manager

`GlobalSystemMediaTransportControlsSessionManager::RequestAsync()` requests manager access. `GetCurrentSession()` returns the session Windows considers most relevant to control.

SMTC must run in an interactive user session. Do not design it as a Windows service/SYSTEM process.

### Session Information

Relevant APIs:

- `GetPlaybackInfo()`
- `GetTimelineProperties()`
- `TryGetMediaPropertiesAsync()`
- `SourceAppUserModelId()`
- `Thumbnail()`

Thumbnail is an `IRandomAccessStreamReference`. Read it with a strict byte limit and convert to a data URL. Missing/invalid artwork must return `None`, never crash.

### Playback Commands Return Bool

These APIs return `IAsyncOperation<bool>`:

- `TryPlayAsync`
- `TryPauseAsync`
- `TryTogglePlayPauseAsync`
- `TrySkipNextAsync`
- `TrySkipPreviousAsync`
- `TryChangePlaybackPositionAsync`

Awaiting without checking the returned boolean is incorrect. `false` means request rejected or unsupported and must become a graceful error/result.

### Seek Units

`TryChangePlaybackPositionAsync` accepts signed 64-bit ticks. One second is `10_000_000` ticks.

Validate input:

- finite
- non-negative
- safely convertible to `i64`

### Capabilities

Use playback controls to determine whether actions are enabled, including `IsPlaybackPositionEnabled`.

Capabilities differ per source. Spotify, browsers, and VLC may expose different subsets. Never assume seek/skip/control availability.

### Polling Strategy

Poll every 500ms, but split expensive and lightweight work:

- Every poll: current session, playback status, timeline, capability changes.
- Only on session/track semantic change: media properties and artwork stream.
- Emit immediate semantic changes.
- Emit periodic position resyncs.
- Emit one session-ended/empty transition.
- Rate-limit repeated errors.

Do not read and base64-encode artwork every 500ms.

### Snapshot/Command Robustness

- Reacquire current session for commands rather than storing fragile session state.
- Missing session returns typed/graceful error.
- Missing metadata uses empty strings.
- Missing duration/position uses `0`.
- Missing artwork uses `None`.
- No WinRT error may panic or terminate poller.

---

## Current Repo Corrections Required

- `src-tauri/src/lib.rs` is untouched scaffold with only `greet`.
- `src-tauri/tauri.conf.json` still uses scaffold product/title.
- `src-tauri/capabilities/default.json` only has default/opener permissions.
- `src/App.tsx` always creates `MockSource`.
- `src/components/Settings/index.tsx` keeps most settings in local React state.
- Zustand `setSource()` currently discards source subscription unsubscribe.
- No TauriSource, settings adapter, window service, tray, keyboard shortcut hook, MiniView, or SMTC modules exist.

## Primary References

- Tauri Store plugin: https://v2.tauri.app/plugin/store/
- Tauri Store API: https://v2.tauri.app/reference/javascript/store/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Tauri permissions: https://v2.tauri.app/security/permissions/
- Tauri system tray: https://v2.tauri.app/learn/system-tray/
- Tauri window customization: https://v2.tauri.app/learn/window-customization/
- Tauri window API: https://v2.tauri.app/reference/javascript/api/namespacewindow/
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Microsoft GSMTC manager: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager
- Microsoft GSMTC session: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession
- Microsoft GSMTC seek: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession.trychangeplaybackpositionasync
- Microsoft GSMTC media properties: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmediaproperties
- Microsoft thumbnail property: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmediaproperties.thumbnail
- Microsoft `globalMediaControl`: https://learn.microsoft.com/en-us/windows/uwp/schemas/appxpackage/uapmanifestschema/element-uap7-capability
