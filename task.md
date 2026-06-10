# VinylDeck Stage 2 Visual Engine Task State

Mode: caveman full
Session focus: Stage 2 visual polish is complete; wait for next user instruction before backend/Tauri shell work.
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

Backend Phase 3 window modes verified. Stop at Manual Checkpoint B3 until user approves Backend Phase 4.

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
- Manual follow-up: fixed Display tab modal overflow and mini blank/white window risk; MiniView now uses compact 280px layout and a top drag region.
