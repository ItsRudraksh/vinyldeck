# VinylDeck Stage 2 Visual Engine Task State

Mode: caveman full
Session focus: Stage 2 visual polish is complete; backend Phase 3 playback/settings authority is approved; Backend Phase 4 is in progress.
Backend phases ignored for now: Master Task List Phase 12 and Phase 13.

## Context Loaded

- `C:\Coding\vinyldeck\.agents\skills\caveman\SKILL.md`
- `C:\Coding\vinyldeck\AGENTS.md`
- All core memory docs in `C:\Coding\vinyldeck\.agents\memory\`
- Top 20 design map and detailed review corpus in `C:\Coding\vinyldeck\.agents\memory\reviews\`
- `C:\Coding\vinyldeck\raw\deep_design_synthesis.md`
- All PRDs in `C:\Coding\vinyldeck\raw\prds\`
- `C:\Coding\vinyldeck\master_task_list.md`
- Settings source prototypes:
  - `C:\Coding\vinyldeck\stitch-ui-designs\stitch_vinyldeck_cinematic_experience\vinyldeck_settings_customization_1\code.html`
  - `C:\Coding\vinyldeck\stitch-ui-designs\stitch_vinyldeck_cinematic_experience\vinyldeck_advanced_settings_1\code.html`

## Locked Visual Rules

- Pure CSS styling, no Tailwind.
- React 19 + TypeScript + `motion/react`.
- Theme tokens through CSS custom properties.
- Vinyl is circle only.
- Motion must use transform/opacity for animation paths.
- Settings is modal over player, not route/page.
- Glass: `backdrop-filter: blur(24px)` panel, `blur(8px)` overlay, 0.5px/1px micro-border, inset top highlight.
- Settings particle canvas: only mounted/open while modal open, RAF cleanup required.
- Toggles: brushed-metal thumb, inset slot track, spring snap.

## Remaining Visual Work

### Phase 9 - Settings Modal

- [x] 9.1 `Settings/index.tsx` full overlay + 640px glass panel. Approved by user.
- [x] 9.2 Gear open/close, AnimatePresence, Escape close. Approved by user.
- [x] 9.3 Sidebar: `THEMES / VINYL / DISPLAY / ABOUT`, mono uppercase, hover `translateX(4px)`. Approved by user.
- [x] 9.4 Theme cards: 5 themes, 2-col grid, 40px disc preview, active accent ring. Approved by user.
- [x] 9.5 Vinyl toggles: Vinyl Wobble, Album Art Ambient, Film Grain. Approved by user. Album Art Ambient remains Noir-only.
- [x] 9.6 Display toggles: Lean-Back Mode, Cursor Hide, Idle Timeout 1-5s slider. Approved by user.
- [x] 9.7 Particle canvas: 25 2px dots, 20% white, upward drift, wrap, open-only. Approved by user.
- [x] 9.8 Music continues; disc visible blurred behind modal. Approved by user.

### Phase 10 - Empty State Polish

- [x] 10.1 Empty disc wordmark center label. Approved by user.
- [x] 10.2 Neutral but alive empty ambient. Approved by user.
- [x] 10.3 Empty TrackInfo and hidden ring confirmed. Approved by user.
- [x] 10.4 Disabled controls state confirmed. Approved by user.
- [x] 10.5 Mock source auto-loads first track on start. Approved by user.

### Phase 11 - Performance & GPU Hardening

- [x] Audit keyframes for transform/opacity only. Approved by user. Known visual-theme exceptions: Aurora `background-position`, Vapor grid `background-position`.
- [x] `will-change` only on active animated elements. Approved by user.
- [x] Confirm RAF/direct DOM rotation path still clean. Approved by user.
- [x] Particle canvas cleanup and tab/reduced-motion safety. Approved by user.
- [x] Vapor grid pure CSS. Approved by user.

## Completed This Session

- Added `src/components/Settings/index.tsx`.
- Added `src/components/Settings/Settings.css`.
- Wired top-right settings trigger in `src/views/MainView.tsx`.
- Replaced first rough gear SVG with cleaner rounded sliders glyph.
- Verified with `npm run build`.
- User manually approved 9.1.
- User manually approved 9.2.
- User manually approved 9.3.
- User manually approved 9.4.
- User manually approved 9.5.
- User manually approved 9.6.
- User manually approved 9.7.
- User manually approved 9.8.
- User manually approved Phase 10 Empty State polish.
- User manually approved Phase 11 Performance & GPU Hardening. No visual loss, performant.

## Current Task

Backend Phase 3 window modes verified. Phase 3 backend-owned playback authority extension B3.8-B3.14 is implemented and manually approved. Phase 3 backend-owned settings authority B3.15-B3.21 is implemented and manually approved. Backend Phase 4 B4.1-B4.6 is manually approved. Backend Phase 5 B5.1-B5.4 is implemented and awaiting Manual Checkpoint B5 approval before Backend Phase 6.

Fresh-session startup prompt: `backend_fresh_session_prompt.md`.

Planned scope:

- Tauri shell, settings persistence, window modes, tray, lifecycle, and focused shortcuts.
- SMTC model, artwork, controls, cached polling, TauriSource adapter, and source lifecycle.
- End-to-end hardening and Windows installers.
- Reuse `.agents/memory/backend-research.md`; do not repeat completed web research.

## Backend Phase 0 Evidence

- B0.1: committed approved planning/research/living docs as `043cebc docs(backend): approve Windows execution plan`; post-commit status clean.
- B0.2: `node --version`, `npm --version`, `rustc --version`, `cargo --version`, `cargo tauri --version`, `npm run build`, and `cargo check --manifest-path src-tauri/Cargo.toml` all exited 0.
- B0.3: temporary SMTC probe requested `GlobalSystemMediaTransportControlsSessionManager` only. No-media run showed manager request ok and no current session. Media-playing run showed manager request ok and current session `Spotify.exe`.
- B0.4: B0 findings recorded in `.agents/memory/state.md`.

## Backend Phase 1 Evidence

- B1.1-B1.2: `tauri.conf.json` now uses VinylDeck identity, `main` label, native decorated centered/resizable window, MSI/NSIS targets, and WebView2 download bootstrapper.
- B1.3: default capability now covers `main` and `mini` with window/event/store permissions only.
- B1.4-B1.5: scaffold `greet` and opener plugin removed; Rust root modules `media`, `window`, `tray` added; Store plugin registered.
- B1.6: npm verification scripts added and verified.
- Automated checks passed: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run check:rust`, `npm run fmt:rust`, `npm run clippy:rust`, `npm run test:rust`.
- Dev launch probe passed: `npm run tauri dev` opened exact window title `VinylDeck`; process tree was stopped after detection.

## Backend Phase 2 Evidence

- B2.1: typed persisted settings contract added with version key; `devForceEmpty` remains runtime-only.
- B2.2-B2.3: Settings controls now use Zustand-owned settings and drive wobble, film grain, lean-back idle, cursor hide, and idle timeout behavior.
- B2.4-B2.6: browser-safe settings adapter added; Tauri Store saves debounced `settings` only; App hydrates settings before starting source.
- B2.7: validation clamps invalid values, applies defaults, and forces Album Art Ambient off outside Noir.
- Verification passed: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, temporary settings validator smoke, and `npm run tauri dev` window smoke.

## Backend Phase 3 Evidence

- B3.1-B3.4: Rust and TypeScript window-mode contracts/adapters added.
- B3.2-B3.3: Rust commands switch main/fullscreen/mini and set always-on-top.
- B3.5-B3.6: functional MiniView added and App routes by Tauri window label; browser stays on MainView.
- B3.7: Settings DISPLAY controls switch modes and toggle always-on-top; persisted settings keep last non-mini mode plus always-on-top.
- Verification passed: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npm run tauri dev` window smoke.

## Current Follow-Up

- User reported Settings DISPLAY tab makes modal too tall and Mini mode opens as a blank/white window.
- Reverted first follow-up fix (`75c2354`) with `b60a7de` at user request.
- Current pass fixes only the Settings DISPLAY modal UX: no scrollable modal; Display tab uses a wider panel, compact 3-column window-mode deck, and compact switch cards.
- Mini mode is not behavior-fixed in this pass. Systematic debugging found a strong local clue in installed Tauri 2.11.2 source: creating a `WebviewWindow` inside a synchronous command on Windows has a documented WebView2 deadlock/half-create risk. Added debug-only Rust logs around mini create/show/focus so next manual test can show whether the white window is failing at build, navigation URL, show, or focus.
- User-provided mini logs confirmed the hang occurs inside `WebviewWindowBuilder::build()`: no URL/show/focus logs appeared after `show_mini: building mini window at app URL index.html`.
- Follow-up mini root fix: `cmd_set_window_mode` changed to async Tauri command and mini creation now completes before hiding the main window.
- User confirmed mini window now works.
- Current mini UX polish: vinyl centered, controls removed from document flow, controls reveal as absolute bottom overlay on pointer/touch activity and fade back down after idle.
- Current mini customization polish: mini renders AmbientLayer/film grain, VaporGrid, and Noir artwork ambient extraction like the main view; adds soft monitor-corner snap when dragged near a corner; adds hover-revealed top-right return-to-main control.
- User reported mini theme/customizations still stale, dragging blocked, and app not exiting after returning to main then closing. Fixes: flush settings before native mode switch, use programmatic mini background dragging, add start-dragging permission, and destroy mini window on main/fullscreen return.
- Mini theme crossing/settings persistence root fix: mini is read-only for persisted settings. Only main subscribes to settings persistence and flushes on unload/cleanup; mini still hydrates settings for correct visuals but cannot poison Tauri Store with DEFAULT_SETTINGS/stale state. See `.agents/memory/bugs/BUG-002-mini-theme-persistence.md`.
- Phase 3 extension B3.8-B3.14 implemented and manually approved: Rust backend owns playback state and commands through a backend mock authority; Tauri main/mini use one backend proxy source; browser keeps MockSource. Future settings/dynamic state should migrate toward backend ownership too.
- B3 Extension automated verification on 2026-06-11 passed: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- User manually approved B3.13 seamless main/mini playback sync on 2026-06-11. Backend mock caveat: `Neon Requiem` and `Warm Static` have no album artwork because their old covers were generated by frontend canvas; this is expected until real SMTC artwork is implemented.
- MiniView polish: track details were moved slightly lower to add vertical breathing room below the vinyl. Verification passed after this polish: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- Phase 3 settings authority B3.15-B3.21 implemented and manually approved: Rust backend owns persisted settings, validates/migrates payloads, writes existing `settings.json` / `settings` key, emits `settings-changed`, and frontend WebViews only hydrate/cache/control via commands/events.
- B3 Settings Authority automated verification passed on 2026-06-11: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- Final Phase 3 bug fix: bottom `ThemePicker` now commits theme and Album Art Ambient changes through backend `commitSettings()`, matching Settings modal behavior. Old direct `setTheme` / `setArtAmbient` store escape hatches were removed. This closes the final settings persistence bypass. Final verification passed: bypass scan returned no matches, `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- Backend Phase 4 B4.1 added a real Tauri tray module/menu with `Open VinylDeck`, `Mini Player`, `Play/Pause`, `Previous`, `Next`, and `Quit`, registered from `lib.rs`. B4.1 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.2 routes tray `Open VinylDeck` and `Mini Player` through the existing Rust window-mode service instead of duplicating show/hide/create logic. B4.2 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.3 routes tray Play/Pause, Previous, and Next through shared backend media command helpers. Missing media state gracefully logs/no-ops. B4.3 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.4 implements close-to-tray: main/mini close requests prevent close and hide windows; tray Quit remains explicit process exit. B4.4 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.5 makes tray left-click release restore/focus Main through the shared window-mode service. B4.5 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.6 updates tray menu presentation from backend media snapshots every 500ms: Play/Pause text, control enabled state, skip enabled state, and tooltip. B4.6 verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 automated checkpoint passed on 2026-06-11: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and `git diff --check` exited 0. Rust tests: 7 passed, 0 failed. Stop at Manual Checkpoint B4.
- User manually approved Backend Phase 4 on 2026-06-11: "all approved fully works move to next."
- Backend Phase 5 B5.1-B5.4 added focused-window keyboard shortcuts: Space toggles playback, Left/Right previous/next, F fullscreen toggle, M mini toggle, T theme cycle, Escape closes Settings before fullscreen exit, and Ctrl+Q invokes backend `cmd_quit`. Shortcut hook ignores form/control/editable targets and is mounted once in main/mini. Focused verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `npm run build`.
- Backend Phase 5 automated verification passed on 2026-06-11: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and `git diff --check` exited 0. Rust tests: 7 passed, 0 failed. Stop at Manual Checkpoint B5.
