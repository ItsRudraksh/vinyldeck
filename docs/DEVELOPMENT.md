# Development Guide

## Setup

```powershell
npm install
npm run tauri dev
```

Use `npm run dev` for browser-only visual work. Browser mode is intentionally mock-backed because Windows SMTC is only available through Tauri.

## Source Modes

| Runtime | Playback source |
| --- | --- |
| Browser/Vite | `MockSource` |
| Tauri dev/build | `TauriSource` over Rust SMTC |
| Tauri with `VITE_FORCE_MOCK_SOURCE=true` | `MockSource` for visual debugging |

## Verification

Run this before claiming a backend or integration change is ready:

```powershell
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
```

For installer/debug bundle smoke checks:

```powershell
npm run tauri build -- --debug
```

Phase 10 last passed this full automated checkpoint with 13 frontend tests and 35 Rust tests.

## Important Paths

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | App boot, settings hydration, source setup, main/mini routing |
| `src/lib/playback/` | Playback contracts, store, mock source, Tauri source |
| `src/lib/settings/` | Frontend settings adapter/cache |
| `src/lib/window/` | Frontend window adapter |
| `src-tauri/src/media/` | SMTC model, artwork, commands, poller |
| `src-tauri/src/settings/` | Rust settings authority |
| `src-tauri/src/window/` | Window mode service |
| `src-tauri/src/tray.rs` | Tray menu and close-to-tray behavior |
| `.agents/memory/` | Living project memory for future agent sessions |

## Coding Rules

- Preserve the `PlaybackSource` contract so the visual engine stays platform-neutral.
- In Tauri, backend commands/events are authority for shared state.
- Keep browser mock behavior working after backend changes.
- Use transform/opacity-first animation paths; documented exceptions are Aurora and Vapor background-position identity effects.
- Do not repeat completed backend web research; use `.agents/memory/backend-research.md`.

## Deferred Distribution Work

Phase 11 is on hold. Before public-style distribution, revalidate clean release installers, WebView2 bootstrap behavior, uninstall/reinstall, settings location, bundle identifier naming, and the live player compatibility matrix.
