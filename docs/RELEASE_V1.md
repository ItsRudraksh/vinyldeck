# VinylDeck V1 Baseline

Date: 2026-06-11 baseline, refreshed 2026-06-14

V1 means the current development build baseline after backend Phase 10 hardening, now refreshed with the 2026-06-14 interaction polish consolidation. Backend Phase 10 and real Spotify sync were user-approved; the latest polish remains pending final manual approval in the live Tauri shell.

## Included

- Cinematic React visual engine with active Noir and Glass shells
- Album-art ambient extraction
- CSS vinyl renderer active; WebGL vinyl renderer code dormant/hard-OFF
- Center spindle hole intentionally removed
- Main, fullscreen, and mini windows
- Backend-owned persisted settings
- Real Windows SMTC media snapshots and in-app controls
- Cached 500ms SMTC poller with bounded artwork loading
- Focused-window keyboard shortcuts
- Keyboard Shortcuts and Quit To Tray toggles
- Tooltips, keycaps, custom context menu, directional track text, and in-place vinyl skip impulse
- Close-to-tray lifecycle and explicit quit
- Automated frontend and Rust regression coverage

## Verification Evidence

Last full automated checkpoint passed on 2026-06-11:

- `npm run build`
- `npm run test:frontend` -> 13 passed
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml` -> 35 passed
- `npm run tauri build -- --debug`

Interaction polish automated checkpoint passed on 2026-06-14 before this consolidation:

- `npm run test:frontend` -> 20 passed
- `npm run build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml` -> 39 passed

Debug artifacts were produced:

- `src-tauri/target/debug/vinyldeck.exe`
- `src-tauri/target/debug/bundle/msi/VinylDeck_0.1.0_x64_en-US.msi`
- `src-tauri/target/debug/bundle/nsis/VinylDeck_0.1.0_x64-setup.exe`

## Deferred

Phase 11 Windows Distribution is on hold:

- Release installer build
- Clean installed-app SMTC validation
- WebView2 bootstrapper validation
- Uninstall/reinstall and settings-location smoke test
- Player compatibility matrix
- Bundle identifier cleanup
- Tray playback menu SMTC unification/revalidation
- Shortcut editing UI, start-with-Windows/autostart, splash screen, active WebGL vinyl, and vinyl left/right slide transitions remain out of scope.
