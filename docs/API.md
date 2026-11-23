# Tauri API Reference

This is the internal command/event contract between the React app and the Tauri backend.

## Playback Snapshot

`MediaSnapshot` maps to the frontend `PlaybackState`.

| Field            | Type             | Notes                                               |
| ---------------- | ---------------- | --------------------------------------------------- |
| `track`          | `string`         | Empty when no media or metadata missing             |
| `artist`         | `string`         | Empty when unavailable                              |
| `album`          | `string`         | Empty when unavailable                              |
| `artworkDataUrl` | `string \| null` | PNG/JPEG data URL, bounded by backend artwork guard |
| `duration`       | `number`         | Seconds; may be `0` when unknown                    |
| `position`       | `number`         | Seconds                                             |
| `isPlaying`      | `boolean`        | Current playback state                              |
| `sourceName`     | `string`         | Friendly source label when known                    |
| `sourceId`       | `string`         | Raw session/source identity                         |
| `canSeek`        | `boolean`        | Enables seek UI and shortcut paths                  |
| `canSkip`        | `boolean`        | Enables previous/next                               |
| `canControl`     | `boolean`        | Enables play/pause/control surface                  |

## Playback Events

| Event                 | Payload         | Meaning                                                                        |
| --------------------- | --------------- | ------------------------------------------------------------------------------ |
| `media-state-changed` | `MediaSnapshot` | Current media changed, controls changed, position resync, or clean empty state |

## SMTC Commands

These commands are used by `TauriSource` in desktop mode.

| Command                      | Args              | Return                  |
| ---------------------------- | ----------------- | ----------------------- |
| `cmd_smtc_snapshot`          | none              | `MediaSnapshot \| null` |
| `cmd_smtc_play`              | none              | `MediaSnapshot \| null` |
| `cmd_smtc_pause`             | none              | `MediaSnapshot \| null` |
| `cmd_smtc_toggle_play_pause` | none              | `MediaSnapshot \| null` |
| `cmd_smtc_next`              | none              | `MediaSnapshot \| null` |
| `cmd_smtc_previous`          | none              | `MediaSnapshot \| null` |
| `cmd_smtc_seek`              | `seconds: number` | `MediaSnapshot \| null` |

Command responses are not the UI source of truth. The frontend sends intent, then accepts poller events as canonical state.

## Legacy Backend Media Commands

The older backend media authority remains registered:

In-app playback does not use these commands in Tauri mode. Tray playback menu code still references this path and should be unified with SMTC before distribution validation.

## Lyrics Commands

These commands run CORS-free HTTP fetches with bounded in-memory caching inside `src-tauri/src/lyrics/mod.rs`.

| Command                                                                                                                                         | Args                                                     | Return                         | Meaning                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cmd_lyrics_fetch`                                                                                                                              | `query: { track, artist, album, duration, bypassCache }` | `RawLyricsResponse \| null`    | Resolves word/syllable or line-synced lyrics across LyricsPlus -> BetterLyrics TTML -> LRCLIB                                                                                                                   |
| `cmd_lyrics_enrich`, and `cmd_lyrics_clear_cache` (wipes the persistent on-disk JSON LRU lyrics cache in `app_data_dir()/lyrics_cache_v1.json`) | `query: { trackKey, lines, targetLang }`                 | `LyricsEnrichResponse \| null` | Per-line bounded-concurrency (`5` workers, chorus-deduplicated) zero-key romanization and translation enrichment returning `{ sourceLang, romanizedLines, translatedLines }` with guaranteed 1:1 line alignment |

## Settings Commands And Events

| Command/Event           | Args/Payload       | Meaning                              |
| ----------------------- | ------------------ | ------------------------------------ |
| `cmd_settings_snapshot` | none               | Load sanitized persisted settings    |
| `cmd_settings_update`   | partial settings   | Validate, persist, and emit settings |
| `cmd_settings_reset`    | none               | Reset to defaults                    |
| `settings-changed`      | persisted settings | Backend-approved settings snapshot   |

Current persisted settings fields include `theme`, `ambientMode`, `artAmbient`, `vinylWobble`, `filmGrain`, `leanBackMode`, `cursorHide`, `idleTimeoutSeconds`, `alwaysOnTop`, `keyboardShortcutsEnabled`, `quitToTray`, `startWithWindows`, `windowMode`, `miniTransparentMode`, `lyricsEnabled`, `lyricsLayout` (`"split" | "strip"`), `lyricsRomanized`, `lyricsAutoRomanize`, `lyricsTranslated`, `lyricsTargetLang`, `lyricsFontFamily` (`"display" | "sans" | "serif" | "mono"`), `lyricsFontSize` (`"sm" | "md" | "lg" | "xl"`), and `lyricsSide` (`"right" | "left"`) (`"en" | "es" | "fr" | "de" | "hi" | "pa" | "ja" | "ko" | "zh" | "pt" | "ar" | "ru"`).

`miniTransparentMode` is Mini-only. When enabled, the Rust window service applies Tauri's native Acrylic window effect to the live Mini window and the Mini WebView removes its opaque background layers so the desktop blurs through behind the vinyl and controls. Main and fullscreen ignore this setting.

The active shell choices are `noir` and `glass`. Legacy theme values `aurora`, `vapor`, and `paper` are migrated into the current shell/ambient model rather than exposed as live choices.

## Window And Lifecycle Commands

| Command                       | Args                                     | Meaning                    |
| ----------------------------- | ---------------------------------------- | -------------------------- |
| `cmd_set_window_mode`         | `mode: "main" \| "fullscreen" \| "mini"` | Switch render/window mode  |
| `cmd_set_always_on_top`       | `enabled: boolean`                       | Apply native always-on-top |
| `cmd_get_current_window_mode` | none                                     | Return current render mode |
| `cmd_quit_app`                | none                                     | Explicit process quit      |

Close button behavior is handled by Rust window events and hides app windows to tray.
When `quitToTray` is `false`, closing main/mini requests explicit app quit instead.
When `startWithWindows` changes, the backend syncs the desired state to the Tauri autostart plugin.
Mini mode creates a separate transparent-capable, frameless, always-on-top WebView window. It starts at `280x280`, can shrink down to `140x140`, and cannot expand beyond the original `280x280` square; entering main/fullscreen destroys the Mini window.
