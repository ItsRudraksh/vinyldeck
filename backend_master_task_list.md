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

> Caveat: mini/main cross-WebView theme/settings authority is parked as pending BUG-002. Continue the backend list, but do not treat mini theme persistence as fully resolved until `.agents/memory/bugs/BUG-002-mini-theme-persistence.md` is revisited.

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
- Known caveat after B3 follow-ups: mini/main cross-WebView theme persistence is pending BUG-002.

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
- Known caveat: mini may not reliably inherit persisted theme/customization state; BUG-002 is skipped for later.

---

## BACKEND PHASE 4 — Tray and Application Lifecycle

- [ ] **B4.1** Build tray module and menu.
  - Create: `src-tauri/src/tray.rs`
  - Items: Open VinylDeck, Mini Player, Play/Pause, Previous, Next, Quit.

- [ ] **B4.2** Reuse window-mode service from tray events.
  - No duplicated window creation/show/hide logic.

- [ ] **B4.3** Route tray playback items through media command service.
  - Before SMTC exists, disable or gracefully no-op controls.

- [ ] **B4.4** Implement close-to-tray lifecycle.
  - Main/mini close request hides window.
  - Explicit Quit exits process.
  - Avoid close-request recursion.

- [ ] **B4.5** Implement tray left-click show/focus behavior.

- [ ] **B4.6** Update tray tooltip/menu enabled state from media snapshot when feasible.

### Automated Checkpoint B4

- `cargo fmt`, `cargo clippy`, `cargo test`, and `npm run build` pass.

### Manual Checkpoint B4

- Tray icon appears once.
- Window X hides app; tray Open restores it.
- Mini Player opens once.
- Quit fully terminates process.

---

## BACKEND PHASE 5 — Focused-Window Keyboard Shortcuts

- [ ] **B5.1** Create `src/hooks/useKeyboardShortcuts.ts`.
  - Space: toggle play/pause.
  - Left/Right: previous/next.
  - F: toggle fullscreen.
  - M: toggle mini.
  - T: cycle theme.
  - Escape: exit fullscreen/close settings first.
  - Ctrl+Q: explicit Tauri exit command.

- [ ] **B5.2** Ignore shortcuts while typing or interacting with form controls.

- [ ] **B5.3** Mount shortcut hook once per active view/source.

- [ ] **B5.4** Add explicit backend quit command instead of `window.close()`.

### Manual Checkpoint B5

- Every shortcut works while window focused.
- Sliders/inputs do not trigger shortcuts.
- Ctrl+Q exits rather than hiding to tray.

---

## BACKEND PHASE 6 — SMTC Core and Data Model

- [ ] **B6.1** Add direct backend error dependency and confirm pinned WinRT features.
  - Add direct `anyhow` dependency or equivalent internal error type.
  - Keep `windows = 0.56` initially.
  - Remove unused Rust image dependency if artwork is passed through unchanged.

- [ ] **B6.2** Define serializable media model.
  - Create: `src-tauri/src/media/model.rs`
  - `MediaSnapshot` must map exactly to frontend `PlaybackState`.
  - Include explicit capabilities and source/session identity.

- [ ] **B6.3** Add pure model tests.
  - Empty snapshot.
  - TimeSpan ticks-to-seconds conversion.
  - Friendly source names.
  - Snapshot semantic-change key.

- [ ] **B6.4** Implement SMTC session acquisition.
  - Create: `src-tauri/src/media/smtc.rs`
  - Use `GetCurrentSession`.
  - Return `Ok(None)` when no session.
  - Never panic on missing fields.

- [ ] **B6.5** Implement lightweight playback/timeline/capability read.
  - Do not fetch media properties/artwork in this path.

- [ ] **B6.6** Implement media property read.
  - Track, artist, album, source identity.
  - Handle empty/inconsistent metadata.

- [ ] **B6.7** Implement bounded artwork stream conversion.
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

- [ ] **B7.1** Create shared current-session command helper.
  - Reacquire current session per command.
  - Return typed “no active session” error.

- [ ] **B7.2** Implement play, pause, toggle, next, previous.
  - Check returned `bool`.
  - Return graceful rejection when source refuses command.

- [ ] **B7.3** Implement seek.
  - Validate finite, non-negative seconds.
  - Convert seconds to 100ns ticks safely.
  - Check returned `bool`.

- [ ] **B7.4** Implement initial snapshot command.

- [ ] **B7.5** Register commands in `src-tauri/src/lib.rs`.

- [ ] **B7.6** Add command input/conversion tests where WinRT can be isolated.

### Manual Checkpoint B7

- Invoke every command from Tauri devtools.
- Spotify controls work.
- Unsupported VLC/browser actions fail gracefully.
- No-media commands do not crash.

---

## BACKEND PHASE 8 — Polling and Event Bridge

- [ ] **B8.1** Implement 500ms polling service.
  - Create: `src-tauri/src/media/poller.rs`
  - Start once from Tauri setup.
  - Poller survives transient SMTC errors.

- [ ] **B8.2** Cache media properties/artwork by session + track identity.
  - Playback/timeline stays lightweight.
  - Artwork reloads only on semantic track/session change.

- [ ] **B8.3** Define event emission policy.
  - Immediate: session, track, play state, capabilities, duration changes.
  - Periodic: position resync.
  - Ended: emit empty/session-ended once.

- [ ] **B8.4** Prevent duplicate pollers and redundant events.

- [ ] **B8.5** Add poller state-machine tests using fake snapshots.

- [ ] **B8.6** Log errors tersely with rate limiting to avoid console floods.

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

- [ ] **B9.1** Create strict Rust snapshot TypeScript contract.
  - Create: `src/lib/playback/tauriSource.ts`
  - Map Rust snake_case fields to locked `PlaybackState`.

- [ ] **B9.2** Implement initial snapshot fetch and event listeners.
  - Retain all unlisten functions.
  - `stop()` calls every unlisten exactly once.
  - Empty/session-ended maps to `EMPTY_PLAYBACK`.

- [ ] **B9.3** Implement fire-and-forget control methods with bounded error logging.

- [ ] **B9.4** Fix Zustand source lifecycle.
  - Retain/call source subscription unsubscribe.
  - Avoid duplicate subscriptions during HMR/source swaps.

- [ ] **B9.5** Add runtime source factory.
  - Create: `src/lib/playback/sourceFactory.ts`
  - Browser → MockSource.
  - Tauri → TauriSource.
  - Explicit force-mock override supported.

- [ ] **B9.6** Wire source factory into `src/App.tsx`.

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
