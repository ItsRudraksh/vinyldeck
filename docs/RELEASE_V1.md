# VinylDeck V1 Baseline

Date: 2026-06-11

V1 means the current development build baseline after backend Phase 10 hardening. It is approved to preserve as a stable milestone before the later Phase 11 distribution pass.

## Included

- Cinematic React visual engine with five themes
- Album-art ambient extraction
- Main, fullscreen, and mini windows
- Backend-owned persisted settings
- Real Windows SMTC media snapshots and in-app controls
- Cached 500ms SMTC poller with bounded artwork loading
- Focused-window keyboard shortcuts
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
