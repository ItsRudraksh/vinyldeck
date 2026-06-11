# VinylDeck Windows Backend Master Task List

> Planning source: `PRD-03-desktop-windows.md`, `PRD-05-build-sequence.md`, current code/contracts, living memory, and primary Tauri/Microsoft documentation.
>
> Scope: finish Phase 1 Windows desktop backend and shell in strict order. Stage 2 visual engine remains isolated behind `PlaybackSource`.
>
> Status: **APPROVED — ready for execution in a fresh session.**

---

## Execution Rules

- Execute one numbered task at a time.
- Run listed automated checks after every task.
- Stop at every manual checkpoint for user approval.
- Do not combine shell, persistence, tray, or SMTC tasks.
- Browser keeps `MockSource`; Tauri dev/build uses real `TauriSource`.
- Never use `--force` or destructive scaffold commands.
- Every backend task must preserve the approved Stage 2 browser experience.

## Approval-Locked Architecture

User approval locks these recommended resolutions:

1. **Main window shell:** keep native Windows decorations for Phase 1 MVP, matching PRD-03 and avoiding visual-engine regression. Fullscreen and Mini are frameless. A custom titlebar remains optional later polish.
2. **Window modes:** `main` and `fullscreen` reuse the main window; `mini` is a separate 280×280 always-on-top window while main hides.
3. **Source selection:** `isTauri()` selects real SMTC in both Tauri dev and production. Plain browser selects `MockSource`. Optional `VITE_FORCE_MOCK_SOURCE=true` allows Tauri visual debugging.
4. **SMTC polling:** poll every 500ms, but cache media properties/artwork. Emit immediate semantic changes and periodic position resyncs; never decode artwork every poll.
5. **Shortcuts:** focused-window shortcuts only. No system-global hotkeys in Phase 1.
6. **Close behavior:** window close hides to tray. Explicit tray Quit exits process.
7. **Settings:** persisted settings become Zustand-owned. Browser uses defaults/in-memory behavior; Tauri uses `tauri-plugin-store`.

> Note: mini/main cross-WebView theme/settings authority is now resolved by backend-owned settings authority. BUG-002's temporary main-only writer fix is superseded: WebViews are readers/controllers only, and Rust validates/persists/emits settings snapshots.
> Forward decision: future dynamic state should use backend-owned command/event authority. Frontend windows should remain readers/controllers, not persistence/state authorities.

## Known PRD Corrections

- PRD command stubs containing `todo!()` are not implementation-ready.
- `TauriSource.stop()` must call retained event unlisten functions.
- `import.meta.env.DEV` cannot choose source because Tauri development must test SMTC.
- SMTC control methods return `bool`; `false` means request rejected/unsupported.
- Windows `globalMediaControl` is a Windows package capability, not a Tauri ACL permission. Validate SMTC in `tauri dev` and built installers separately.
- Current direct `windows = 0.56` dependency stays pinned initially. Upgrade only if a verified blocker requires it.

---

## BACKEND PHASE 0 — Baseline and Safety Gate

- [x] **B0.1** Commit approved backend planning documents, then confirm clean Git working tree.
  - Include: `backend_master_task_list.md`, `.agents/memory/backend-research.md`, and linked living-doc updates.
  - Run after commit: `git status --short`
  - Expected: empty.

- [x] **B0.2** Verify toolchain and existing frontend/backend builds.
  - Run: `node --version`, `npm --version`, `rustc --version`, `cargo tauri --version`
  - Run: `npm run build`
  - Run: `cargo check --manifest-path src-tauri/Cargo.toml`
  - Expected: all exit 0.

- [x] **B0.3** Verify Windows SMTC runtime availability with a minimal Rust probe before building architecture.
  - Probe only requests `GlobalSystemMediaTransportControlsSessionManager`.
  - Test once with no media and once with Spotify/browser media playing.
  - Remove probe after findings are recorded.

- [x] **B0.4** Record verified SMTC behavior and any environment-specific errors in `.agents/memory/state.md`.

### Manual Checkpoint B0

- Tauri scaffold opens.
- SMTC manager request succeeds in interactive Windows session.
- Current source session is visible when media is playing.

---

## BACKEND PHASE 1 — Tauri Shell Foundation

- [x] **B1.1** Replace scaffold identity in `src-tauri/tauri.conf.json`.
  - Product/title: `VinylDeck`
  - Identifier: `com.vinyldeck.app`
  - Main label: `main`
  - Native decorated, centered, resizable main window.
  - Set intentional default/min dimensions after testing approved visual layout.

- [x] **B1.2** Configure Windows bundle and WebView2 bootstrapper.
  - Keep NSIS/MSI targets.
  - Add Windows `downloadBootstrapper` WebView2 install mode.
  - Keep existing Tauri icons until a final VinylDeck icon asset exists.

- [x] **B1.3** Replace default capabilities with least-privilege main/mini permissions.
  - Add only required window, event, and store permissions.
  - Include both `main` and `mini` labels.
  - Remove unused opener permission/plugin unless About content needs external links.

- [x] **B1.4** Replace scaffold `greet` command and organize Rust root modules.
  - Modify: `src-tauri/src/lib.rs`
  - Keep: `src-tauri/src/main.rs` as thin binary entry.
  - Create module declarations for `media`, `window`, and `tray`.

- [x] **B1.5** Register `tauri-plugin-store` in Rust builder.

- [x] **B1.6** Add backend verification scripts/documented commands.
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - `npm run build`

### Automated Checkpoint B1

- `npm run build` passes.
- `cargo fmt --check` passes.
- `cargo clippy -- -D warnings` passes.
- `cargo test` passes.
- `npm run tauri dev` opens a window titled VinylDeck.

### Manual Checkpoint B1

- Native VinylDeck window opens centered.
- Resize respects minimum size.
- Approved Stage 2 visuals remain unchanged.

---

## BACKEND PHASE 2 — Settings State and Persistence

- [x] **B2.1** Define typed persisted settings contract.
  - Create: `src/lib/settings/types.ts`
  - Include: theme, art ambient, vinyl wobble, film grain, lean-back mode, cursor hide, idle timeout, always-on-top, window mode.
  - Exclude runtime-only `devForceEmpty`.

- [x] **B2.2** Promote local Settings component values into Zustand.
  - Modify: `src/lib/playback/store.ts`
  - Modify: `src/components/Settings/index.tsx`
  - Preserve current defaults and Noir-only art ambient rule.

- [x] **B2.3** Wire promoted settings into visual behavior.
  - Vinyl wobble controls playing wobble class.
  - Film grain controls ambient grain.
  - Lean-back controls idle-mode activation.
  - Cursor hide controls idle cursor behavior.
  - Idle timeout controls `useIdleMode`.

- [x] **B2.4** Create browser-safe settings persistence adapter.
  - Create: `src/lib/settings/index.ts`
  - Tauri: load/save through `@tauri-apps/plugin-store`.
  - Browser: return defaults and skip disk writes.
  - Validate loaded values and merge with defaults.

- [x] **B2.5** Hydrate settings before source startup without theme flash.
  - Modify: `src/App.tsx`
  - Apply loaded theme/settings once.
  - Keep initial Noir prepaint fallback.

- [x] **B2.6** Subscribe only to persisted Zustand fields and debounce saves.
  - Avoid saving playback position/source/runtime QA state.
  - Flush or rely on graceful store save during exit.

- [x] **B2.7** Add settings migration/version key.
  - Unknown/invalid values fall back safely.
  - Future fields can be added without corrupting existing settings.

### Automated Checkpoint B2

- `npm run build` passes.
- `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- Settings serializer/validator tests pass.

### Manual Checkpoint B2

- Change every setting, quit explicitly, reopen.
- Values persist and behaviors remain wired.
- Browser development still works without Tauri APIs.
- B3 follow-up fix: mini/main cross-WebView theme persistence uses main-only write authority; mini reads settings but does not persist.

---

## BACKEND PHASE 3 — Window Modes

- [x] **B3.1** Define shared typed window-mode contract.
  - Create: `src/lib/window/types.ts`
  - Modes: `main | fullscreen | mini`.

- [x] **B3.2** Implement Rust window-mode service.
  - Create: `src-tauri/src/window/mod.rs`
  - Keep mode switching logic separate from command wrappers.
  - Main: show main, leave fullscreen, hide mini.
  - Fullscreen: show/focus main, hide mini, enter fullscreen.
  - Mini: create/show mini, hide main.

- [x] **B3.3** Implement always-on-top command for active windows.

- [x] **B3.4** Implement frontend window adapter.
  - Create: `src/lib/window/index.ts`
  - Use Tauri invoke only when `isTauri()`.
  - Detect current window label through Tauri window API.

- [x] **B3.5** Create functional `MiniView`.
  - Create: `src/views/MiniView.tsx`
  - Reuse playback store and existing physical vinyl controls.
  - Keep scope functional/minimal; visual refinement gets separate approval.

- [x] **B3.6** Route app view by current Tauri window label.
  - Modify: `src/App.tsx`
  - Browser always renders `MainView`.

- [x] **B3.7** Persist last non-mini window mode and always-on-top.

### Automated Checkpoint B3

- Rust window command tests pass for mode parsing/invalid modes.
- `npm run build`, `cargo clippy`, and `cargo test` pass.

### Manual Checkpoint B3

- Main ↔ fullscreen works repeatedly.
- Main ↔ mini works repeatedly without duplicate mini windows.
- Mini remains always-on-top and main restores correctly.
- Multi-monitor focus/position behavior is acceptable.
- B3 follow-up fix: mini inherits persisted theme/customization state by hydration, while persistence writes remain main-only.

---

## BACKEND PHASE 3 EXTENSION — Backend-Owned Playback Authority

> New gate before tray/lifecycle. Do not enter Backend Phase 4 until B3.8-B3.14 are approved and manually verified.
>
> Goal: eliminate main/mini playback divergence before adding tray, shortcuts, or SMTC. Every Tauri window must read playback state from one backend-owned authority and send controls to that authority. Browser remains visual-dev-only with `MockSource`.

- [x] **B3.8** Define the backend-owned playback authority contract.
  - Create/modify Rust model types so the backend event payload maps exactly to frontend `PlaybackState`.
  - Include track, artist, album, artwork data URL, duration, position, `isPlaying`, source name/id, `canSeek`, `canSkip`, and `canControl`.
  - Keep the locked frontend `PlaybackState`/`PlaybackSource` interface intact.
  - Do not implement SMTC here; use a backend mock provider to prove the authority and multi-window sync shape.

- [x] **B3.9** Implement a backend mock media authority.
  - The backend owns one mutable media state, not the WebViews.
  - Backend mock supports play, pause, toggle, next, previous, seek, and position ticking.
  - It emits snapshots to all windows on semantic changes and periodic position resync.
  - This is temporary provider plumbing that later SMTC replaces behind the same authority contract.

- [x] **B3.10** Add Tauri media commands/events for authority access.
  - Commands: get current snapshot, play, pause, toggle, next, previous, seek.
  - Events: media snapshot changed and media session ended/empty.
  - Commands must route to backend authority, never to a frontend-owned source.
  - Events must be safe for any number of windows to subscribe.

- [x] **B3.11** Create frontend `TauriSource` as a thin backend proxy.
  - In Tauri, `PlaybackSource.start()` subscribes to backend media events and fetches initial snapshot.
  - `PlaybackSource.play/pause/toggle/next/previous/seekTo` invoke backend commands.
  - `PlaybackSource.stop()` must call all retained Tauri event unlisten functions.
  - No Tauri WebView creates its own `MockSource`.

- [x] **B3.12** Refactor source selection and App boot.
  - Browser keeps `MockSource`.
  - Tauri main and mini both use `TauriSource`.
  - Main and mini can mount independently and still receive the same backend state.
  - Preserve main-only settings write authority from BUG-002.

- [x] **B3.13** Verify seamless main/mini playback sync.
  - Main and mini show the same track, play/pause state, artwork, source, and position.
  - Controls from either window update the same backend state and reflect in all open windows.
  - Rapid main ↔ mini switching does not reset track, position, or play/pause.
  - No duplicate frontend mock timers or duplicate playback authorities exist in Tauri.
  - User manually approved seamless playback sync on 2026-06-11. Note: Neon Requiem/Warm Static have no album artwork in the backend mock because the old frontend mock generated those two covers with canvas; this is expected mock-data behavior, not a sync failure.

- [x] **B3.14** Record backend authority migration rule for future settings/dynamic state.
  - Update memory docs: backend-owned state is preferred for multi-window dynamic state.
  - Note that settings remain main-write-only temporarily, but should migrate to backend-owned authority after B3.8-B3.14 proves the pattern.
  - Future tray, shortcuts, SMTC, and settings should talk to backend commands/events instead of window-to-window bridges.

### Automated Checkpoint B3 Extension

- `npm run build` passes.
- `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- Rust tests cover model conversion and backend mock command behavior.

### Manual Checkpoint B3 Extension

- Open main, switch to mini, return to main repeatedly: playback state remains continuous.
- Main and mini show identical track/artwork/play-pause/source state.
- Main controls update mini.
- Mini controls update main.
- Rapid switching cannot create duplicate playback authorities or reset state.
- Browser development still uses `MockSource` and approved Stage 2 visuals remain unchanged.

---

## BACKEND PHASE 3 EXTENSION 2 — Backend-Owned Settings Authority

> Final gate before tray/lifecycle. Playback authority proved the backend command/event pattern. Persisted settings must now use the same backend-owned authority so no WebView writes durable state.

- [x] **B3.15** Define Rust settings authority contract.
  - Rust model mirrors frontend `PersistedSettings` with camelCase serde payloads.
  - Contract includes theme, art ambient, vinyl wobble, film grain, lean-back mode, cursor hide, idle timeout, always-on-top, window mode, and version.
  - Runtime QA state such as `devForceEmpty` remains frontend-only.

- [x] **B3.16** Implement Rust settings validation and migration.
  - Invalid theme/window mode fall back safely.
  - Idle timeout clamps to 1-5 seconds.
  - Non-Noir themes force Album Art Ambient off.
  - Version is normalized to `1`.

- [x] **B3.17** Move settings persistence writes to Rust backend.
  - Backend uses `tauri-plugin-store` Rust API with existing `settings.json` / `settings` key.
  - Backend sanitizes existing saved settings on startup and rewrites the safe shape.
  - WebViews no longer load or save Store directly.

- [x] **B3.18** Add backend settings commands/events.
  - Commands: `cmd_settings_snapshot`, `cmd_settings_update`, `cmd_settings_reset`.
  - Event: `settings-changed`.
  - Any number of windows can subscribe and receive the same backend-approved settings snapshot.

- [x] **B3.19** Convert frontend settings module to backend proxy/cache.
  - Browser development keeps default/in-memory settings behavior.
  - Tauri uses commands/events only.
  - Frontend validation remains as defensive payload guard, not persistence authority.

- [x] **B3.20** Remove frontend settings write authority.
  - Removed WebView Store dependency usage and Store capability permission.
  - Removed `flushSettingsPersistence()` / `subscribeToSettingsPersistence()` path.
  - `App.tsx` hydrates from backend and subscribes to backend `settings-changed` events in all windows.

- [x] **B3.21** Route Settings UI mutations through backend authority.
  - Theme/toggle/slider/window mode changes call `cmd_settings_update`.
  - Settings UI applies returned backend-approved settings locally.
  - Native window actions still call existing window commands after settings update.

### Automated Checkpoint B3 Settings Authority

- `npm run build` passes.
- `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- Rust tests cover settings validation, non-Noir art ambient clamp, timeout clamp, and mini not being persisted as last window mode.

### Manual Checkpoint B3 Settings Authority

- Change theme in main; mini updates to same theme without reload.
- Change Film Grain/Vinyl Wobble/Lean-Back/Cursor Hide/Idle Timeout in main; mini reflects same settings.
- Change a setting from mini if reachable; main reflects same backend-approved setting.
- Switch Main -> Mini -> Main rapidly; settings do not reset or poison to defaults.
- Quit/reopen app; persisted settings load correctly.
- Browser development still uses in-memory defaults and approved Stage 2 visuals remain unchanged.
- User manually approved B3 Settings Authority on 2026-06-11 after final fix: bottom ThemePicker theme/art-ambient controls now persist through backend settings authority, matching Settings modal behavior.

---

## BACKEND PHASE 4 — Tray and Application Lifecycle

- [x] **B4.1** Build tray module and menu.
  - Create: `src-tauri/src/tray.rs`
  - Items: Open VinylDeck, Mini Player, Play/Pause, Previous, Next, Quit.

- [x] **B4.2** Reuse window-mode service from tray events.
  - No duplicated window creation/show/hide logic.

- [x] **B4.3** Route tray playback items through media command service.
  - Before SMTC exists, disable or gracefully no-op controls.

- [x] **B4.4** Implement close-to-tray lifecycle.
  - Main/mini close request hides window.
  - Explicit Quit exits process.
  - Avoid close-request recursion.

- [x] **B4.5** Implement tray left-click show/focus behavior.

- [x] **B4.6** Update tray tooltip/menu enabled state from media snapshot when feasible.

### Automated Checkpoint B4

- `cargo fmt`, `cargo clippy`, `cargo test`, and `npm run build` pass.

### Manual Checkpoint B4

- Tray icon appears once.
- Window X hides app; tray Open restores it.
- Mini Player opens once.
- Quit fully terminates process.

---

## BACKEND PHASE 5 — Focused-Window Keyboard Shortcuts

- [x] **B5.1** Create `src/hooks/useKeyboardShortcuts.ts`.
  - Space: toggle play/pause.
  - Left/Right: previous/next.
  - F: toggle fullscreen.
  - M: toggle mini.
  - T: cycle theme.
  - Escape: exit fullscreen/close settings first.
  - Ctrl+Q: explicit Tauri exit command.

- [x] **B5.2** Ignore shortcuts while typing or interacting with form controls.

- [x] **B5.3** Mount shortcut hook once per active view/source.

- [x] **B5.4** Add explicit backend quit command instead of `window.close()`.

### Manual Checkpoint B5

- Every shortcut works while window focused.
- Sliders/inputs do not trigger shortcuts.
- Ctrl+Q exits rather than hiding to tray.

---

## BACKEND PHASE 6 — SMTC Core and Data Model

- [x] **B6.1** Add direct backend error dependency and confirm pinned WinRT features.
  - Add direct `anyhow` dependency or equivalent internal error type.
  - Keep `windows = 0.56` initially.
  - Remove unused Rust image dependency if artwork is passed through unchanged.

- [x] **B6.2** Define serializable media model.
  - Create: `src-tauri/src/media/model.rs`
  - `MediaSnapshot` must map exactly to frontend `PlaybackState`.
  - Include explicit capabilities and source/session identity.

- [x] **B6.3** Add pure model tests.
  - Empty snapshot.
  - TimeSpan ticks-to-seconds conversion.
  - Friendly source names.
  - Snapshot semantic-change key.

- [x] **B6.4** Implement SMTC session acquisition.
  - Create: `src-tauri/src/media/smtc.rs`
  - Use `GetCurrentSession`.
  - Return `Ok(None)` when no session.
  - Never panic on missing fields.

- [x] **B6.5** Implement lightweight playback/timeline/capability read.
  - Do not fetch media properties/artwork in this path.

- [x] **B6.6** Implement media property read.
  - Track, artist, album, source identity.
  - Handle empty/inconsistent metadata.

- [x] **B6.7** Implement bounded artwork stream conversion.
  - Create: `src-tauri/src/media/artwork.rs`
  - Read thumbnail stream with maximum byte limit.
  - Detect JPEG/PNG MIME from bytes.
  - Return `None` for missing/invalid/oversized artwork.

### Automated Checkpoint B6

- `cargo test` passes model/artwork helper tests.
- `cargo clippy -- -D warnings` passes.

### Manual Checkpoint B6

- Diagnostic snapshot works for Spotify.
- Repeat with browser media and VLC.
- Missing artwork/metadata never crashes.

---

## BACKEND PHASE 7 — SMTC Commands

- [x] **B7.1** Create shared current-session command helper.
  - Reacquire current session per command.
  - Return typed “no active session” error.

- [x] **B7.2** Implement play, pause, toggle, next, previous.
  - Check returned `bool`.
  - Return graceful rejection when source refuses command.

- [x] **B7.3** Implement seek.
  - Validate finite, non-negative seconds.
  - Convert seconds to 100ns ticks safely.
  - Check returned `bool`.

- [x] **B7.4** Implement initial snapshot command.

- [x] **B7.5** Register commands in `src-tauri/src/lib.rs`.

- [x] **B7.6** Add command input/conversion tests where WinRT can be isolated.

### Manual Checkpoint B7

- Invoke every command from Tauri devtools.
- Spotify controls work.
- Unsupported VLC/browser actions fail gracefully.
- No-media commands do not crash.

---

## BACKEND PHASE 8 — Polling and Event Bridge

- [x] **B8.1** Implement 500ms polling service.
  - Create: `src-tauri/src/media/poller.rs`
  - Start once from Tauri setup.
  - Poller survives transient SMTC errors.

- [x] **B8.2** Cache media properties/artwork by session + track identity.
  - Playback/timeline stays lightweight.
  - Artwork reloads only on semantic track/session change.

- [x] **B8.3** Define event emission policy.
  - Immediate: session, track, play state, capabilities, duration changes.
  - Periodic: position resync.
  - Ended: emit empty/session-ended once.

- [x] **B8.4** Prevent duplicate pollers and redundant events.

- [x] **B8.5** Add poller state-machine tests using fake snapshots.

- [x] **B8.6** Log errors tersely with rate limiting to avoid console floods.

### Automated Checkpoint B8

- Poller tests pass.
- Rust checks pass.
- No repeated artwork conversion during unchanged playback.

### Manual Checkpoint B8

- Track change reaches frontend within ~500ms.
- Pause/play updates promptly.
- Position stays accurate without event spam.
- Closing media app produces one clean empty-state transition.

---

## BACKEND PHASE 9 — Frontend TauriSource Integration

- [x] **B9.1** Create strict Rust snapshot TypeScript contract.
  - `src/lib/playback/tauriSource.ts` now accepts unknown IPC payloads, validates the Rust `MediaSnapshot` camelCase serde contract, maps null/undefined snapshots to `EMPTY_PLAYBACK`, and outputs the locked `PlaybackState`.
  - Verified with `npm run build`.

- [x] **B9.2** Implement initial snapshot fetch and event listeners.
  - `TauriSource.start()` subscribes to `media-state-changed` and fetches initial real SMTC state via `cmd_smtc_snapshot`.
  - Retains Tauri unlisten functions, handles start/stop races, and `stop()` releases each retained unlistener once.
  - Empty/session-ended/null snapshots map to `EMPTY_PLAYBACK`.
  - Verified with `npm run build` and `git diff --check`.

- [x] **B9.3** Implement fire-and-forget control methods with bounded error logging.
  - Play/pause/toggle/next/previous/seek now invoke real `cmd_smtc_*` commands.
  - Command responses are ignored; poller events remain the playback truth source.
  - Repeated command failures are rate-limited to one warning per command per 5 seconds.
  - Verified with `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, command registration scan, and `git diff --check`.

- [x] **B9.4** Fix Zustand source lifecycle.
  - Store now owns `clearSource(source?)`, calling retained source subscription unsubscribe and `source.stop()` together.
  - App cleanup calls `clearSource(source)` instead of directly stopping the local source.
  - `setSource()` ignores same-source duplicate subscription attempts and clears failed starts only if that source is still current.
  - Verified with `npm run build` and lifecycle scan.

- [x] **B9.5** Add runtime source factory.
  - Created `src/lib/playback/sourceFactory.ts`.
  - Browser resolves to MockSource.
  - Tauri resolves to TauriSource unless `VITE_FORCE_MOCK_SOURCE=true`.
  - Verified with `npm run build`.

- [x] **B9.6** Wire source factory into `src/App.tsx`.
  - `App.tsx` now calls `createPlaybackSource()` instead of duplicating `isTauri()` / force-mock logic.
  - Verified with `npm run build` and source-selection scan.

- [ ] **B9.7** Add adapter mapping/lifecycle tests.

### Automated Checkpoint B9

- `npm run build` passes strict TypeScript.
- Adapter tests pass.
- Rust checks pass.

### Manual Checkpoint B9

- Browser still runs MockSource.
- `npm run tauri dev` displays real system media.
- HMR/reloads do not duplicate events.
- Artwork drives existing Noir ambient path.

---

## BACKEND PHASE 10 — End-to-End Hardening

- [ ] **B10.1** Test full no-media lifecycle.
  - Cold start with no media.
  - Media starts after app.
  - Media app exits.
  - Session switches between players.

- [ ] **B10.2** Test metadata/artwork edge cases.
  - Missing artwork.
  - Empty title/artist.
  - Oversized artwork.
  - Unknown duration/position.

- [ ] **B10.3** Test command capability edge cases.
  - Can play but cannot seek.
  - Can pause but cannot skip.
  - Command returns false.

- [ ] **B10.4** Test lifecycle edge cases.
  - Close-to-tray while playing.
  - Restore main/mini repeatedly.
  - Explicit quit.
  - Reopen with persisted settings.

- [ ] **B10.5** Run complete verification suite.
  - `npm run build`
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - `npm run tauri build -- --debug`

### Manual Checkpoint B10

- Spotify, YouTube Music/browser, and VLC tested.
- Visual engine remains performant.
- All controls, tray, settings, shortcuts, and window modes pass.

---

## BACKEND PHASE 11 — Windows Distribution

- [ ] **B11.1** Build release installers.
  - Run: `npm run tauri build`
  - Verify MSI and NSIS outputs.

- [ ] **B11.2** Install built package and validate SMTC separately from `tauri dev`.
  - Confirms Windows packaging/capability behavior.

- [ ] **B11.3** Validate WebView2 bootstrapper behavior.

- [ ] **B11.4** Smoke-test uninstall/reinstall and settings location.

- [ ] **B11.5** Record known player compatibility matrix.
  - Spotify
  - Chrome/YouTube Music
  - Edge
  - VLC

### Final Manual Checkpoint

- Clean installed VinylDeck launches and reads system media.
- Close-to-tray and explicit quit work.
- Settings persist.
- Installer/uninstaller behave correctly.

---

## Planned File Map

### Create

- `src-tauri/src/media/mod.rs`
- `src-tauri/src/media/model.rs`
- `src-tauri/src/media/smtc.rs`
- `src-tauri/src/media/artwork.rs`
- `src-tauri/src/media/commands.rs`
- `src-tauri/src/media/poller.rs`
- `src-tauri/src/window/mod.rs`
- `src-tauri/src/tray.rs`
- `src/lib/settings/types.ts`
- `src/lib/settings/index.ts`
- `src/lib/window/types.ts`
- `src/lib/window/index.ts`
- `src/lib/playback/tauriSource.ts`
- `src/lib/playback/sourceFactory.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/views/MiniView.tsx`

### Modify

- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src/App.tsx`
- `src/lib/playback/store.ts`
- `src/components/Settings/index.tsx`
- `src/views/MainView.tsx`
- `src/hooks/useIdleMode.ts`
- Visual components only where promoted settings must control existing approved effects.

---

## Required Skills During Execution

- `rust-pro`: all Rust/Tauri/SMTC tasks.
- `typescript-pro`: adapter/settings/window contracts.
- `zustand-store-ts`: persisted settings/store lifecycle.
- `systematic-debugging`: first response to compile/runtime/SMTC failures.
- `verification-before-completion`: every task/checkpoint.
- `react-component-performance`: event/store integration and multi-window render audits.

## Out of Scope

- Audio reactivity/WASAPI.
- Mobile ports.
- System-global hotkeys.
- Auto-updater.
- Cloud accounts/authentication.
- Library/playlist browsing.
- Custom titlebar unless user explicitly replaces recommended native Phase 1 shell decision.

## Primary References Verified

- Tauri v2 Store plugin: plugin registration and `load()`/save behavior.
- Tauri v2 capabilities/permissions: frontend command access is capability-gated.
- Tauri v2 system tray and window APIs.
- Tauri v2 close-request semantics and event listener cleanup.
- Microsoft GSMTC session manager, session controls, timeline, and thumbnail stream APIs.
- Microsoft confirms `TryChangePlaybackPositionAsync` uses ticks and returns success `bool`.
- Detailed reusable synthesis: `.agents/memory/backend-research.md`.
