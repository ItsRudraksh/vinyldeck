# VinylDeck: Current State

**Current Phase:** Phase 1 (Windows Desktop MVP)
**Current Stage:** Windows backend — Phase 10 end-to-end hardening active; B10.1-B10.3 complete, next B10.4

## Active Work
Backend Phase 3 window modes, backend-owned playback authority, and backend-owned settings authority are verified and user-approved. Backend Phase 4 B4.1-B4.6 was manually approved by user on 2026-06-11. Backend Phase 5 B5.1-B5.4 was manually approved by user on 2026-06-11 with one benign WebView2 shutdown log noted. Backend Phase 6 B6.1-B6.7 was manually approved by user on 2026-06-11. Backend Phase 7 B7.1-B7.6 was manually approved by user on 2026-06-11 after devtools testing against Spotify. Backend Phase 8 B8.1-B8.6 plus sync fix are implemented, verified, and manually approved. Backend Phase 9 B9.1-B9.7 are implemented, automated-checkpoint verified, and manually approved. Backend Phase 10 is active; B10.1-B10.3 are implemented and verified. Next task is B10.4 lifecycle edge cases.

Current task track:
- Phase 9.1 Settings shell is complete and user-approved.
- Phase 9.2 Settings open/close behavior is complete and user-approved.
- Phase 9.3 Settings sidebar is complete and user-approved.
- Phase 9.4 Settings theme cards are complete and user-approved.
- Phase 9.5 Settings vinyl toggles are complete and user-approved. Album Art Ambient remains Noir-only.
- Phase 9.6 Settings display controls are complete and user-approved.
- Phase 9 Settings Modal is complete and user-approved.
- Phase 10.1 Empty disc wordmark is complete and user-approved.
- Phase 10 Empty State polish is complete and user-approved.
- Phase 11 Performance & GPU Hardening is complete, build-verified, and user-approved.
- Idle Centerpiece Transform is complete and user-approved: when idle triggers during playback, vinyl area moves toward true viewport center and scales up using transform-only CSS transition; activity restores original layout.
- User confirmed visual satisfaction and authorized backend planning.
- Backend plan is approved and ready to build.

## Stage 2 Final Status
- Core visual engine sub-stages 2a–2k implemented and verified.
- Master Task List visual polish phases 9–11 are complete.
- Stage 2 Visual Engine has passed the latest visual/performance approval loop.
- Color extraction finalized: `fast-average-color` simple algorithm — LOCKED.
- Zero TypeScript errors. Zero unused dependencies. Vite HMR clean.
- Dev server: http://localhost:1420/

## Known Broken
- Mini mode blank/white-window root cause under active verification: manual logs showed execution stuck at `show_mini: building mini window at app URL index.html`, before URL/show/focus logs. This confirms the mini hang is inside `WebviewWindowBuilder::build()`, matching installed Tauri 2.11.2's Windows/WebView2 warning about building webview windows from synchronous commands. `cmd_set_window_mode` has been changed to an async Tauri command, and mini creation now completes before hiding main so failed creation cannot strand the user with the main window hidden.

## Latest Session Notes
- Added Settings modal shell in `src/components/Settings/index.tsx`.
- Added Settings glass/modal styling in `src/components/Settings/Settings.css`.
- Wired top-right settings trigger in `src/views/MainView.tsx`.
- Replaced rough gear icon with clean rounded sliders glyph.
- Added Settings sidebar tabs: `THEMES / VINYL / DISPLAY / ABOUT`.
- Sidebar uses mono uppercase labels, active rail, restrained glass active state, and `translateX(4px)` hover.
- Added Settings theme cards: 5 theme cards, 2-column grid, 40px circular disc previews, active accent ring, click-to-switch theme.
- Added Settings VINYL toggles: Vinyl Wobble, Album Art Ambient, Film Grain with brushed-metal thumbs and spring snap. Album Art Ambient is wired to existing `artAmbient` store toggle and only shows for Noir; other two are local visual settings for now.
- Added Settings DISPLAY controls: Lean-Back Mode, Cursor Hide, Idle Timeout 1-5s slider with physical thumb styling. These are local visual settings for now.
- Added Settings particle canvas behind modal: 25 upward-drifting dots, white at 12-20% opacity, open-only mount, RAF cleanup on unmount, honors `prefers-reduced-motion`.
- Confirmed by static code check that Settings overlay does not call playback source controls; music should continue while open. Disc remains visible through 8px scrim blur and 24px panel blur.
- Filled Settings ABOUT section with concise identity/build details.
- Added empty vinyl center wordmark: `VINYLDECK` in theme display font when no track title/artwork exists. Artwork-missing tracks still use first-letter fallback.
- Added ABOUT-tab `Test Empty State` toggle for visual QA.
- Added store-level `devForceEmpty` mask so empty state can be inspected without stopping MockSource.
- MainView now uses an effective empty playback snapshot when forced empty: no artwork, duration 0, isPlaying false, no source badge, controls disabled, ring hidden.
- Disabled controls now render at 0.35 opacity.
- Store `setSource()` now writes `source.getState()` immediately before async source start to avoid cold-start empty flash.
- Phase 11 perf pass: changed `ledPulse` and `glow-pulse` keyframes to opacity-only pulses, moved vinyl wrapper `will-change` to playing-only wobble state, removed permanent `will-change` from static vinyl label and Settings nav items.
- Phase 11 audit confirmed `useVinylRotation` still uses RAF + direct DOM transform mutation, mouse specular remains direct CSS property mutation, Settings particle canvas cleans RAF/listeners on unmount and respects reduced motion, Vapor grid remains pure CSS.
- Deliberate visual-theme exceptions remain: Aurora background shift and Vapor grid travel animate `background-position` because those effects are the theme identity and are scoped to one background layer.
- Added idle centerpiece behavior in `MainView`: vinyl area transitions with `translate3d(0, clamp(72px, 8.8vh, 96px), 0) scale(1.22)` while idle, then returns to the normal stacked appliance layout on activity.
- `npm run build` passes after changes.
- User manually approved Phase 9.1.
- User manually approved Phase 9.2.
- User manually approved Phase 9.3.
- User manually approved Phase 9.4.
- User manually approved Phase 9.5.
- User manually approved Phase 9.6.
- User manually approved Phase 9.7.
- User manually approved Phase 9.8.
- User manually approved Phase 10.1.
- User manually approved Phase 10 Empty State pass.
- User manually approved Phase 11 Performance & GPU Hardening: "very performant indeed no visual loss."
- User manually approved Idle Centerpiece Transform.
- User confirmed visual satisfaction and requested complete Windows backend plan.
- Backend research found required corrections to PRD snippets: use runtime `isTauri()` source selection, retain Tauri event unlisten functions, cache SMTC artwork outside 500ms light polling, and honor SMTC command `bool` results.
- Backend plan approved. Research synthesis saved at `.agents/memory/backend-research.md`; future sessions should not repeat this research.
- Fresh-session execution prompt saved at `backend_fresh_session_prompt.md`.
- B0.1 committed approved backend planning documents in commit `043cebc docs(backend): approve Windows execution plan`; post-commit `git status --short` was empty.
- B0.2 baseline verified on 2026-06-10: `node --version` -> `v24.12.0`; `npm --version` -> `11.6.2`; `rustc --version` -> `rustc 1.96.0 (ac68faa20 2026-05-25)`; `cargo --version` -> `cargo 1.96.0 (30a34c682 2026-05-25)`; `cargo tauri --version` -> `tauri-cli 2.11.2`; `npm run build` exited 0; `cargo check --manifest-path src-tauri/Cargo.toml` exited 0.
- B0.3 temporary Rust SMTC probe verified `GlobalSystemMediaTransportControlsSessionManager::RequestAsync()` succeeds in this interactive Windows session.
- B0.3 no-media run: manager request ok; `GetCurrentSession()` returned no session with message `The operation completed successfully. (0x00000000)`.
- B0.3 media-playing run: manager request ok; current session visible; `SourceAppUserModelId()` returned `Spotify.exe`.
- Temporary probe file `src-tauri/examples/smtc_probe.rs` was removed after both runs; no permanent backend architecture added in B0.
- B1.1 set Tauri product/window identity to VinylDeck, main window label `main`, native decorations, centered/resizable `900x700`, min `700x560`.
- B1.2 set Windows bundle targets to `msi` and `nsis`, added WebView2 `downloadBootstrapper`, retained existing scaffold icons.
- B1.3 expanded default capability to `main` and `mini` with window/event/store permissions; removed unused opener permission.
- B1.4 removed scaffold `greet`, created root module stubs for `media`, `window`, and `tray`.
- B1.5 registered `tauri-plugin-store` in Rust builder and removed unused opener plugin dependencies from npm/Cargo.
- B1.6 added npm verification scripts: `check:rust`, `fmt:rust`, `clippy:rust`, `test:rust`.
- B1 verification on 2026-06-10: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run check:rust`, `npm run fmt:rust`, `npm run clippy:rust`, and `npm run test:rust` exited 0.
- B1 dev launch probe started `npm run tauri dev`, detected exact window title `VinylDeck`, then stopped the process tree; no VinylDeck dev process remained after teardown.
- Rust components `rustfmt` and `clippy` were missing initially and installed with `rustup component add rustfmt clippy`; rerun checks passed.
- B2.1 created typed persisted settings contract at `src/lib/settings/types.ts`: theme, art ambient, vinyl wobble, film grain, lean-back mode, cursor hide, idle timeout, always-on-top, window mode, version key. Runtime `devForceEmpty` remains excluded.
- B2.2 promoted Settings modal local controls into Zustand-owned `settings` state while preserving `artAmbient` as Noir-only.
- B2.3 wired `vinylWobble`, `filmGrain`, `leanBackMode`, `cursorHide`, and `idleTimeoutSeconds` into existing visual behavior without changing approved CSS styling.
- B2.4 added browser-safe settings adapter at `src/lib/settings/index.ts`; browser returns defaults and skips disk writes, Tauri uses `@tauri-apps/plugin-store`.
- B2.5 App startup now loads and applies settings before starting the playback source, preserving Noir prepaint fallback.
- B2.6 Tauri persistence subscribes only to `settings` and debounces saves; playback/source/runtime QA state is not persisted.
- B2.7 added settings validation and version migration guard; invalid values merge/fall back safely and non-Noir art ambient is forced off.
- B2 verification on 2026-06-10: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml` exited 0.
- B2 validator smoke used a temporary `tsx` runner and passed: defaults, invalid values, non-Noir art ambient clamp, idle timeout clamp, and full valid object.
- B2 Tauri smoke started `npm run tauri dev`, detected `VinylDeck` window, then stopped the process tree; no VinylDeck dev process remained after teardown.
- B3.1 added shared typed window-mode contract in `src/lib/window/types.ts`.
- B3.2 implemented Rust window-mode service in `src-tauri/src/window/mod.rs`: main restores native decorated main, fullscreen reuses main borderless, mini creates/reuses separate `280x280` always-on-top frameless window while hiding main.
- B3.3 added `cmd_set_always_on_top` for active main/mini windows.
- B3.4 added browser-safe frontend window adapter in `src/lib/window/index.ts`.
- B3.5 added functional `MiniView` using the playback store, existing vinyl, track info, and controls.
- B3.6 App now routes render by current Tauri window label; browser remains main view.
- B3.7 Settings DISPLAY controls can switch Main/Fullscreen/Mini and toggle Always On Top; last non-mini mode and always-on-top persist through existing settings store.
- B3 verification on 2026-06-10: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml` exited 0. Rust tests included valid/invalid window-mode parser coverage.
- B3 Tauri smoke started `npm run tauri dev`, detected `VinylDeck` window, then stopped the process tree; no VinylDeck dev process remained after teardown.
- Browser verification is user-controlled for now; do not use Browser unless user explicitly asks.
- Follow-up `75c2354 fix(window): repair display modal and mini view` was reverted by `b60a7de` at user request.
- Current follow-up pass fixes only Settings DISPLAY modal height UX by widening the Display panel and compacting controls into a three-column window-mode deck plus three compact switch cards; it intentionally avoids a scrollable modal solution.
- Current follow-up pass also adds debug-only Rust window logs for mini mode without changing mini URL/architecture. Smoke on 2026-06-10 opened the main `VinylDeck` window and printed `[VinylDeck window] cmd_set_window_mode requested: main`; mini still needs manual trigger to capture the new mini logs.
- User-provided mini logs on 2026-06-10 captured the hang boundary: `cmd_set_window_mode requested: mini` → `show_mini: start` → `show_mini: hiding main window` → `show_mini: building mini window at app URL index.html`, then no further app logs until manual Ctrl+C. Follow-up fix made `cmd_set_window_mode` async and moved main hide after mini build.
- User confirmed async mini fix works. Mini UX polish now keeps the vinyl centered in the 280px window, moves track text and controls out of normal layout flow, and shows the controls as an absolute bottom overlay only during pointer/touch activity before fading them back down.
- Mini now follows main-window visual customizations in mini mode: AmbientLayer uses persisted Film Grain, VaporGrid renders for Vapor, and Noir Album Art Ambient extraction runs when enabled. Mini also adds soft corner snapping near monitor work-area corners while preserving free placement elsewhere, plus a hover-revealed top-right return-to-main button.
- Mini bug follow-up: user logs showed mini first-create URL is initially `about:blank`, then reused mini loads `http://localhost:1420/`. One attempted mini-theme fix made Settings save before opening native mini, but later evidence showed cross-WebView persistence remained unresolved. Drag was blocked because full-cover child layers sat above CSS drag region; mini now uses `startDragging()` from background mouse-down with controls/buttons excluded. Closing main after mini return did not exit because hidden mini stayed alive; returning main/fullscreen now destroys the mini window instead of hiding it.
- Mini theme-crossing/settings persistence root fix: only the main WebView has persisted-settings write authority. Mini still loads/hydrates settings for visuals, but `App.tsx` gates `subscribeToSettingsPersistence()`, `beforeunload` flush, and cleanup `flushSettingsPersistence()` behind `currentRenderMode === "main"`. Root cause was mini cleanup flushing DEFAULT_SETTINGS/stale Zustand state into Tauri Store before/after hydration. Canonical bug note: `.agents/memory/bugs/BUG-002-mini-theme-persistence.md`.
- Phase 3 extension B3.8-B3.14 implemented and manually approved: Rust backend now owns playback state through a backend mock media authority and emits snapshots to all windows. Tauri main and mini use a thin `TauriSource` proxy that subscribes to backend snapshots and invokes backend commands. Browser still uses `MockSource` unless `VITE_FORCE_MOCK_SOURCE=true` is set in Tauri. User confirmed main/mini playback state is seamless.
- B3 Extension automated verification on 2026-06-11: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check` exited 0. Rust test count is now 4: backend mock media authority plus window-mode parser coverage.
- Backend mock artwork caveat: `Neon Requiem` and `Warm Static` intentionally have `artworkDataUrl: null` in the Rust backend mock because the old frontend `MockSource` generated their art with browser canvas. This is expected mock-data behavior, not a backend sync bug. Real SMTC artwork should arrive from the future SMTC provider behind the same authority contract.
- MiniView polish on 2026-06-11: track details were nudged downward to add more vertical gap below the vinyl. Verification passed after this polish: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- Phase 3 settings authority extension B3.15-B3.21 implemented and manually approved: Rust backend now owns persisted settings through `src-tauri/src/settings/mod.rs`, validates/migrates settings, writes existing `settings.json` / `settings` key via Rust `tauri-plugin-store`, and emits `settings-changed` to all windows. Frontend settings module is now a backend command/event proxy; WebViews no longer use `@tauri-apps/plugin-store`, `flushSettingsPersistence`, or settings persistence subscriptions.
- B3 Settings Authority automated verification on 2026-06-11: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check` exited 0. Rust test count is now 7, including settings validation/clamp/mini-not-persisted coverage.
- Final Phase 3 bug fix: bottom `ThemePicker` now commits theme and Album Art Ambient changes through backend `commitSettings()` instead of direct local store setters. User confirmed settings modal path already worked; this fixed the last persistence bypass before Phase 4. Old direct `setTheme` / `setArtAmbient` store escape hatches were removed. Final verification passed: bypass scan returned no matches, `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `git diff --check`.
- Backend Phase 4 B4.1 implemented on 2026-06-11: `src-tauri/src/tray.rs` now builds one tray icon with menu items `Open VinylDeck`, `Mini Player`, `Play/Pause`, `Previous`, `Next`, and `Quit`; `src-tauri/src/lib.rs` registers tray setup during Tauri setup. Quit exits through `app.exit(0)`. Open/Mini/playback item behavior remains for B4.2-B4.5. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.2 implemented on 2026-06-11: `src-tauri/src/window/mod.rs` exposes crate-local `WindowMode` and `set_window_mode`; tray `Open VinylDeck` and `Mini Player` menu events call the shared service through an async runtime task, avoiding duplicated window creation/show/hide logic. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.3 implemented on 2026-06-11: media command wrappers now share helper functions in `src-tauri/src/media/commands.rs`, and tray Play/Pause/Previous/Next menu events call those helpers against backend `MediaState`. Missing media state logs and no-ops instead of crashing. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.4 implemented on 2026-06-11: global Tauri window close events route through `tray::handle_window_close`; main/mini close requests call `api.prevent_close()` and hide instead of closing. Tray Quit remains explicit `app.exit(0)`. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.5 implemented on 2026-06-11: tray left-click release routes through the shared window-mode service to show/focus Main. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 B4.6 implemented on 2026-06-11: tray menu presentation loop reads backend `MediaState` every 500ms, updates Play/Pause text, enables/disables playback menu items, and updates tooltip with current track/artist/source when available. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 4 automated checkpoint passed on 2026-06-11: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and `git diff --check` exited 0. Rust tests: 7 passed, 0 failed. Stop at Manual Checkpoint B4.
- User manually approved Backend Phase 4 on 2026-06-11: "all approved fully works move to next."
- Backend Phase 5 B5.1-B5.4 implemented on 2026-06-11: added `src/hooks/useKeyboardShortcuts.ts`, mounted it once in `MainView` and `MiniView`, ignored shortcuts from input/textarea/select/button/contenteditable targets, wired Space/Left/Right/F/M/T/Escape/Ctrl+Q, added frontend `quitApplication()`, and registered Rust `cmd_quit` for explicit process exit. Escape closes Settings before exiting fullscreen. Focused verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, and `npm run build`.
- Backend Phase 5 automated verification passed on 2026-06-11: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and `git diff --check` exited 0. Rust tests: 7 passed, 0 failed. Stop at Manual Checkpoint B5.
- User manually approved Backend Phase 5 on 2026-06-11: shortcuts work. User reported WebView2/Chromium shutdown log `Failed to unregister class Chrome_WidgetWin_0. Error = 1412` after quit. Research indicates this is upstream WebView2/Chromium teardown noise when the app otherwise exits cleanly; VinylDeck still hardened explicit quit by destroying main/mini windows before `app.exit(0)`.
- Backend Phase 6 B6.1 implemented on 2026-06-11: added direct `anyhow = "1"` backend error dependency, confirmed `windows v0.56.0` remains pinned, removed direct unused `image = "0.25"` dependency from `Cargo.toml` while Tauri still uses `image` transitively for `image-png`. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `rg "^image =|^anyhow =|windows = \\{ version" src-tauri/Cargo.toml`, and `cargo tree --manifest-path src-tauri/Cargo.toml -e normal -p vinyldeck`.
- Backend Phase 6 B6.2 verified on 2026-06-11: existing `src-tauri/src/media/model.rs` from backend authority work already defines serializable `MediaSnapshot` matching locked frontend `PlaybackState`: track, artist, album, artwork data URL, duration, position, `isPlaying`, source name/id, and `canSeek`/`canSkip`/`canControl`, with serde `rename_all = "camelCase"`. No code rewrite was needed.
- Backend Phase 6 B6.3 implemented on 2026-06-11: added pure model helpers/tests in `src-tauri/src/media/model.rs` for empty snapshot defaults, Windows 100ns tick-to-seconds conversion, friendly source names, and semantic snapshot keys that ignore position drift but change on track/capability changes. Focused verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::model` (5 passed), and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 6 B6.4 implemented on 2026-06-11: added `src-tauri/src/media/smtc.rs` with minimal GSMTC session acquisition using `GlobalSystemMediaTransportControlsSessionManager::RequestAsync()`, `GetCurrentSession()`, safe `Ok(None)` no-session behavior, and source id/friendly name mapping. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 6 B6.5 implemented on 2026-06-11: `current_lightweight_snapshot()` reads SMTC playback status, timeline duration/position, and controls/capabilities without calling `TryGetMediaPropertiesAsync()` or touching artwork. It preserves source id/name from session acquisition. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 6 B6.6 implemented on 2026-06-11: `current_media_snapshot_without_artwork()` reads SMTC title, artist, and album via `TryGetMediaPropertiesAsync()` while leaving artwork for B6.7. Missing/inconsistent metadata falls back to empty strings. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 6 B6.7 implemented on 2026-06-11: added `src-tauri/src/media/artwork.rs` with bounded thumbnail conversion, JPEG/PNG magic-byte MIME detection, base64 data URL output, and empty/unknown/oversized rejection. SMTC metadata read now fills `artwork_data_url` when thumbnail conversion succeeds. Focused verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::artwork` (3 passed), and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 6 automated checkpoint passed on 2026-06-11: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and `git diff --check` exited 0. Rust tests: 15 passed, 0 failed. Stop at Manual Checkpoint B6.
- User manually approved Backend Phase 6 on 2026-06-11: "all approved verified all fixed and working move to next go !!"
- Backend Phase 7 B7.1-B7.6 implemented on 2026-06-11: added shared SMTC current-session command helper, real SMTC play/pause/toggle/next/previous/seek helpers that check returned bools, finite/non-negative seek validation with 100ns tick conversion, registered devtools-facing `cmd_smtc_*` commands in `lib.rs`, and added pure tests for seek conversion/rejection and false command-result handling. `cmd_smtc_snapshot` returns metadata/timeline/capabilities without artwork for now because Tauri command futures must be `Send` and WinRT thumbnail stream refs are `!Send`; artwork helper remains for the later poller/thread-bound integration. Focused verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::smtc` (3 passed), and `cargo check --manifest-path src-tauri/Cargo.toml`.
- User manually approved Backend Phase 7 on 2026-06-11: all SMTC devtools commands worked against Spotify. User asked why `artworkDataUrl` was null; answer recorded: SMTC artwork is a stream and should be converted stream -> bytes -> data URL inside the Phase 8 poller/backend boundary, not directly inside the B7 Tauri command future.
- Backend Phase 8 B8.1 implemented on 2026-06-11: added `src-tauri/src/media/poller.rs`, exposed it from `media::poller`, starts a single guarded SMTC poller from Tauri setup, polls lightweight SMTC snapshots every 500ms, emits `media-state-changed`, and survives transient errors by logging and continuing. The old mock 500ms backend event loop was removed from setup so mock and real SMTC events do not fight over the same channel; backend mock commands remain for B9 source-command migration. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml` (19 passed).
- Backend Phase 8 B8.2 implemented on 2026-06-11: poller now keeps cached media properties/artwork by source + duration track identity; 500ms poll path reads lightweight playback/timeline/capabilities and only calls full metadata/artwork load when cache key changes or cache is empty. Full artwork conversion runs on a dedicated named OS thread using `tauri::async_runtime::block_on`, because compiler evidence showed WinRT thumbnail stream refs are `!Send` inside Tauri async spawn. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml` (21 passed).
- Backend Phase 8 B8.3 implemented on 2026-06-11: poller now owns event emission policy. First snapshot and semantic key changes emit immediately; position-only drift is quiet until a 2s resync interval; losing the SMTC session emits one `MediaSnapshot::default()` empty transition and then stays silent until a new session appears. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, and `cargo test --manifest-path src-tauri/Cargo.toml` (23 passed).
- Backend Phase 8 B8.4 verified on 2026-06-11: duplicate pollers are blocked by `SMTC_POLLER_STARTED.compare_exchange`; redundant unchanged 500ms events are blocked by `should_emit_snapshot`; session end emits once via `session_ended_snapshot`. No extra code was required beyond B8.1/B8.3 implementation. Verification passed: `cargo test --manifest-path src-tauri/Cargo.toml media::poller` (5 passed), `cargo check --manifest-path src-tauri/Cargo.toml`, and code scan for `SMTC_POLLER_STARTED`, `should_emit_snapshot`, `session_ended_snapshot`, and `POSITION_RESYNC_INTERVAL_MS`.
- Backend Phase 8 B8.5 implemented on 2026-06-11: extracted pure `handle_polled_snapshot()` and added fake-snapshot state-machine coverage for first event, suppressed unchanged poll, periodic position resync, semantic track change, one empty transition, and repeated no-session silence. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo test --manifest-path src-tauri/Cargo.toml media::poller` (6 passed), and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- Backend Phase 8 B8.6 implemented on 2026-06-11: poller transient error logging is rate-limited to one log per 5 seconds, with suppressed-repeat counts folded into the next emitted error. Phase 8 automated checkpoint passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml` (25 passed), `npm run build`, and `git diff --check`. Stop at Manual Checkpoint B8.
- Backend Phase 8 sync fix implemented and manually approved on 2026-06-11: stale previous-song metadata/artwork root cause was the poller cache key using only `source_id + duration`, so same-duration Spotify tracks reused old cached metadata/artwork while timeline updated. Fix changed B8 poller to read SMTC metadata text every poll, key artwork cache by `source_id + track + artist + album + duration`, and reload/decode artwork only when that metadata identity changes. Progress sync was improved by projecting SMTC timeline `Position` using `LastUpdatedTime` and current system time before emitting snapshots. User manually confirmed "all synced correctly now seamless." Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::poller`, `cargo test --manifest-path src-tauri/Cargo.toml media::smtc`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml` (27 passed), and `npm run build`.
- Backend Phase 9 B9.1 implemented on 2026-06-11: `src/lib/playback/tauriSource.ts` now defines a strict frontend `BackendMediaSnapshot` contract matching Rust `MediaSnapshot` camelCase serde output, validates unknown Tauri IPC/event payloads at runtime, maps null/undefined snapshots to `EMPTY_PLAYBACK`, rejects malformed events with a warning, and only notifies the locked `PlaybackState` shape. Verification passed: `npm run build`.
- Backend Phase 9 B9.2 implemented on 2026-06-11: `TauriSource.start()` now subscribes to `media-state-changed` and fetches the initial real SMTC snapshot via `cmd_smtc_snapshot` instead of the old backend mock snapshot command. Listener registration is retained, `stop()` releases retained Tauri unlisteners exactly once, a start/stop race disposes late-arriving unlisteners immediately, and null/no-session snapshots map to `EMPTY_PLAYBACK`. Verification passed: `npm run build` and `git diff --check`.
- Backend Phase 9 B9.3 implemented on 2026-06-11: TauriSource play/pause/toggle/next/previous/seek now invoke real `cmd_smtc_*` commands in fire-and-forget mode. Command responses are ignored so the B8 poller/event stream remains authoritative for UI state, and repeated command failures are rate-limited to one warning per command per 5 seconds. Verification passed: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, command registration scan, and `git diff --check`.
- Backend Phase 9 B9.4 implemented on 2026-06-11: Zustand playback store now owns source teardown through `clearSource(source?)`, which calls the retained source subscription unsubscribe and `source.stop()` together, resets playback to `EMPTY_PLAYBACK`, ignores stale cleanup requests for non-current sources, and prevents same-source duplicate subscriptions. `App.tsx` cleanup now calls `clearSource(source)` instead of directly stopping the source. Verification passed: `npm run build` and lifecycle scan.
- Backend Phase 9 B9.5 implemented on 2026-06-11: added `src/lib/playback/sourceFactory.ts` with `createPlaybackSource()` and `isForceMockSourceEnabled()`. Browser resolves to `MockSource`; Tauri resolves to `TauriSource` unless `VITE_FORCE_MOCK_SOURCE=true`. App wiring remains for B9.6. Verification passed: `npm run build`.
- Backend Phase 9 B9.6 implemented on 2026-06-11: `src/App.tsx` now calls `createPlaybackSource()` from `src/lib/playback/sourceFactory.ts` instead of duplicating `isTauri()` and `VITE_FORCE_MOCK_SOURCE` source-selection logic. Verification passed: `npm run build` and source-selection scan.
- Backend Phase 9 B9.7 implemented on 2026-06-11: added Vitest frontend test runner (`npm run test:frontend`) plus adapter/lifecycle tests. `src/lib/playback/tauriSource.test.ts` covers valid Rust `MediaSnapshot` camelCase payloads, null/undefined to `EMPTY_PLAYBACK`, and malformed payload rejection. `src/lib/playback/store.test.ts` covers one subscription per source, source event routing into Zustand playback state, teardown unsubscribe/stop/reset, stale cleanup guards, and source swaps. Verification passed: `npm run test:frontend` (8 passed) and `npm run build`.
- Backend Phase 9 automated checkpoint passed on 2026-06-11: `npm run build`; `npm run test:frontend` (8 passed); `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`; `cargo check --manifest-path src-tauri/Cargo.toml`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`; `cargo test --manifest-path src-tauri/Cargo.toml` (27 passed); and `git diff --check`. Stop at Manual Checkpoint B9.
- User manually approved Backend Phase 9 on 2026-06-11: "all works all approved lets move to next !!"
- Backend Phase 10 B10.1 implemented on 2026-06-11: added Rust poller regression `full_no_media_lifecycle_emits_clean_transitions`, covering cold no-media silence, media start emission, media app exit one clean empty transition, repeated no-media silence, media restart, and session switch between players. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::poller::tests::full_no_media_lifecycle_emits_clean_transitions`, `cargo test --manifest-path src-tauri/Cargo.toml media::poller` (8 passed), and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Backend Phase 10 B10.2 implemented on 2026-06-11: added/verified edge coverage for missing artwork, empty title/artist/album, oversized/unknown artwork bytes, and unknown duration/position. Rust model now verifies semantic keys normalize unknown/non-finite durations while preserving empty metadata; poller verifies sparse metadata/missing artwork snapshots emit cleanly and unknown timeline values resync without crashing; artwork tests already reject empty/unknown/oversized bytes; frontend adapter accepts empty metadata/null artwork/zero timeline and rejects non-finite or malformed payloads. Verification passed: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml media::model` (6 passed), `cargo test --manifest-path src-tauri/Cargo.toml media::poller` (9 passed), `cargo test --manifest-path src-tauri/Cargo.toml media::artwork` (3 passed), `npm run test:frontend -- tauriSource` (4 passed), and `npm run build`.
- Backend Phase 10 B10.3 implemented on 2026-06-11: added frontend capability gates in `src/lib/playback/capabilities.ts` with tests for play/pause without seek, play/pause without skip, no transport control, and unknown-duration seek disablement. `Controls` now receives `canSkip` and disables previous/next independently from play/pause; Main/Mini pass `canSkip`; keyboard Left/Right shortcuts respect `canSkip`, while Space respects `canControl`. Rust SMTC tests now verify false command results preserve action-specific error context for pause/next/seek. Verification passed: `npm run test:frontend -- capabilities` (4 passed), `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, and `cargo test --manifest-path src-tauri/Cargo.toml media::smtc` (6 passed).

## Incident Note
- During Stage 1 scaffold, `npx create-tauri-app . --force` was used. The `--force` flag wiped `raw/`, `.agents/memory/`, `stitch-ui-designs/`, and all other pre-existing project files. User restored from backup. **Do NOT use `--force` or any destructive flag in this directory ever again.**

## Environment (Verified)
- Node.js: v24.12.0
- npm: v11.6.2
- Rust: rustc 1.96.0 (ac68faa20 2026-05-25)
- Cargo: cargo 1.96.0 (30a34c682 2026-05-25)
- cargo-tauri CLI: v2.11.2

## What Is On Disk (Stage 2 — Final)

### Styles (`src/styles/`)
- `global.css` — OLED black reset, Google Fonts (Sora/Inter/JetBrains Mono), GPU helpers
- `themes.css` — 5 themes (Noir/Glass/Aurora/Vapor/Paper) as CSS custom property blocks
- `animations.css` — @keyframes: vinyl-spin, breathe, grain-shift, needle-drop, etc.

### Components
- `VinylRecord/` — Full layer stack (glow/disc/grooves/sheen/reflection/label/hole), RAF rotation, mouse specular
- `NeedleArm/` — Spring motion.div (stiffness:60, damping:18, mass:1.2), brushed metal, pulsing LED
- `AmbientLayer/` — Fixed orbs (mix-blend-mode:screen, 70vw/55vw), vignette, animated SVG film grain 3.5%
- `ProgressRing/` — SVG arc with motion.circle, null when duration=0
- `TrackInfo/` — AnimatePresence crossfade (key=track+artist)
- `Controls/` — 3 SVG buttons with spring tap/hover, play glow
- `ThemePicker/` — 5 swatch buttons with active glow border
- `SourceBadge/` — Fixed bottom-right pill badge

### Hooks
- `useVinylRotation.ts` — RAF loop, direct DOM mutation, inertia (spin-up 0.06, brake 0.018 lerp)
- `useColorExtraction.ts` — fast-average-color simple + HSL boost, applies to CSS custom props

### Lib
- `lib/playback/types.ts` — PlaybackState + PlaybackSource interfaces (PRD-01 §6.1 locked)
- `lib/playback/mockSource.ts` — 4-track mock, canvas-rendered PNG artwork (no auto-cycling), real JPEGs for tracks 1-2
- `lib/playback/store.ts` — Zustand v5 + subscribeWithSelector, position extrapolation
- `lib/themes/applier.ts` — applyTheme(), applyAmbientColors(), resetAmbientColors()

### Views
- `views/MainView.tsx` — Final z-stack (AmbientLayer/vinyl-area/TrackInfo/Controls/ThemePicker/SourceBadge)
- `views/MiniView.tsx` + `views/MiniView.css` — 280px mini player with centered vinyl and pointer-revealed absolute controls overlay

### Entry Points
- `main.tsx` — CSS imports + data-theme="noir" before first paint
- `App.tsx` — Creates MockSource → setSource → renders MainView

### Deleted (Stale Scaffold Artifacts)
- `src/App.css` — Vite default scaffold, not used
- `src/assets/react.svg` — Vite default scaffold, not used

## Dependencies (Final — package.json)
- `fast-average-color` ^9.5.2 — ambient color extraction
- `motion` ^12.40.0 — spring animations
- `react` ^19.1.0, `react-dom` ^19.1.0
- `zustand` ^5.0.14 — global state
- `@tauri-apps/api` ^2, `@tauri-apps/plugin-opener` ^2, `@tauri-apps/plugin-store` ^2.4.3

### Removed During Session
- `@vibrant/core` — vibrance-first, wrong for ambient mood extraction
- `node-vibrant` — Node.js-only, browser adapter broken
- `colorthief` — MMCQ area-dominant, crushed dark-zone colors on real photos
