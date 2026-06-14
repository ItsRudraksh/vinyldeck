# VinylDeck Interaction Polish Task List

> Scope source: `changes`, current git state, `master_task_list.md`, `backend_master_task_list.md`, README/docs, living memory, and current code.
>
> Status: **AUTOMATED IMPLEMENTATION COMPLETE — browser-audited during final consolidation, awaiting user manual approval in live Tauri shell.**
>
> Scope included: backlog items 2-9 only:
> scrub UI blink, tonearm completeness, shadcn-style tooltips, keyboard-shortcut toggle, custom context menu, quit-to-tray toggle, directional track fade-slide, and prev/next vinyl reverse motion.
>
> Scope excluded for later discussion: performance/WebGL lag, shortcut editing UI, start-with-Windows, splash screen.

---

## Implementation Update — 2026-06-14

- [x] Items 2-4: Optimistic seek display, track-change direction metadata, directional `TrackInfo` transitions, and vinyl skip impulse are implemented.
- [x] Item 5: Main tonearm visual pass is implemented, including pivot/counterweight, headshell/cartridge/stylus, and an added headshell connector after screenshot feedback showed the tip assembly was disconnected.
- [x] Item 6: `Kbd` and `Tooltip` primitives are implemented and wired to playback controls plus the Settings trigger.
- [x] Item 7: `keyboardShortcutsEnabled` is persisted through frontend validation and Rust settings authority; OFF disables all focused shortcuts except Escape for Settings/fullscreen.
- [x] Item 8: `quitToTray` is persisted through frontend validation and Rust settings authority; OFF makes main/mini close requests perform explicit quit instead of hide-to-tray.
- [x] Item 9: Theme-aware right-click context menu is implemented in main and mini views with playback, Art Ambient, window-mode, Settings (main only), and Quit actions.
- [x] Automated checks passed: `npm run test:frontend` (20 passed), `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo test --manifest-path src-tauri/Cargo.toml` (39 passed), and `git diff --check` for touched files.
- [x] User-feedback fix pass on 2026-06-14: custom tooltips now replace native theme/title tooltips and anchor to the actual fixed child element; theme picker and track info have custom hover tooltips; Glass context menu overflow/separation/border styling is repaired; Keyboard Shortcuts and Quit To Tray moved to new `OTHER` Settings tab; About copy rewritten as product-facing app info; empty-state QA toggle is hidden with `display: none`.
- [ ] Manual approval pending in live Tauri shell, especially tonearm connector, right-click menu placement, tooltip feel, shortcut toggle, close/quit-to-tray behavior, and native mini/tray lifecycle.
- [x] Final consolidation Browser audit on 2026-06-14 confirmed main player loads at `http://localhost:1420/`, CSS renderer active, no WebGL canvas mounted, no `.vinyl-hole`, play/pause visual state works, previous/next update tracks while record center stays anchored, Glass shell switches, Settings opens with `LOOK/VINYL/DISPLAY/OTHER/ABOUT`, `OTHER` exposes Keyboard Shortcuts and Quit To Tray, and custom context menu opens at pointer.

## Execution Rules

- Execute phases in order. Do not start next phase until checkpoint passes.
- Keep each task small and reversible.
- Do not touch WebGL/performance architecture except where needed to avoid worsening existing lag.
- Do not implement shortcut editing, autostart, or splash screen in this plan.
- Do not redesign visuals from memory. For tonearm work, inspect master reference HTML/image directly before code changes.
- Preserve real SMTC authority: playback UI sends intent; backend/poller remains truth.
- Preserve browser mock mode.
- Update `.agents/memory/state.md` and relevant docs only after approved implementation is verified.

## Current Repo Constraints

- Working tree is already dirty with large visual/settings changes.
- `HEAD` added shader/WebGL vinyl; working tree currently removes the live shader from `VinylRecord` and falls back to CSS pressing.
- Plan execution should begin with a safety snapshot of `git status --short` and `git diff --stat`; never revert user/previous-session changes.
- If build fails before implementation, treat as baseline blocker and stop for user direction.

## Planned File Map

### Likely Create

- `src/components/Tooltip/index.tsx`
- `src/components/Tooltip/Tooltip.css`
- `src/components/Kbd/index.tsx`
- `src/components/Kbd/Kbd.css`
- `src/components/AppContextMenu/index.tsx`
- `src/components/AppContextMenu/AppContextMenu.css`
- `src/lib/shortcuts/types.ts`
- `src/lib/trackTransition/types.ts`

### Likely Modify

- `src/components/ProgressRing/index.tsx`
- `src/views/MainView.tsx`
- `src/views/MiniView.tsx`
- `src/components/NeedleArm/index.tsx`
- `src/components/NeedleArm/NeedleArm.css`
- `src/components/Controls/index.tsx`
- `src/components/Controls/Controls.css`
- `src/components/TrackInfo/index.tsx`
- `src/components/TrackInfo/TrackInfo.css`
- `src/components/VinylRecord/index.tsx`
- `src/hooks/useVinylRotation.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/lib/playback/store.ts`
- `src/lib/settings/types.ts`
- `src/lib/settings/index.ts`
- `src-tauri/src/settings/mod.rs`
- `src-tauri/src/tray.rs`
- `src/styles/global.css`
- `src/styles/themes.css`
- `docs/API.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `.agents/memory/state.md`

### Reference Files To Inspect During Execution

- `shadcn-tooltip.md`
- `shadcn-kbd.md`
- `shadcn-context-menu.md`
- `.agents/memory/top_20_designs.md`
- `.agents/memory/reviews/detailed_vinyldeck_master_cinematic_experience.md`
- `stitch-ui-designs/stitch_vinyldeck_cinematic_analog_visualizer/vinyldeck_master_cinematic_experience/code.html`
- `stitch-ui-designs/stitch_vinyldeck_cinematic_analog_visualizer/vinyldeck_master_cinematic_experience/screen.png`

---

## PHASE 0 — Planning Gate And Baseline

> Goal: know exactly what baseline we are changing before touching task code.

- [ ] **0.1** Record working-tree baseline.
  - Run: `git status --short --branch`
  - Run: `git diff --stat`
  - Expected: dirty files match known visual/settings/LiquidGlass branch.

- [ ] **0.2** Verify current frontend/Rust compile baseline.
  - Run: `npm run build`
  - Run: `npm run test:frontend`
  - Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
  - Run: `cargo test --manifest-path src-tauri/Cargo.toml`
  - Expected: pass, or stop and report baseline failure.

- [ ] **0.3** Freeze excluded work.
  - Confirm no implementation task touches:
    - WebGL/performance architecture beyond incidental build fixes.
    - shortcut editing UI.
    - start-with-Windows/autostart.
    - splash screen/window launch choreography.

### Manual Checkpoint 0

- User confirms plan scope still matches: only tasks 2-9.

---

## PHASE 1 — Scrub-To-Seek UI Blink Fix

> Problem: while scrubbing, UI moves to requested timestamp, then snaps back to old backend position, then jumps forward after SMTC catches up.
>
> Goal: keep progress UI optimistically pinned at the user-selected seek position until backend catches up or a short timeout expires.

- [ ] **1.1** Add seek-pending state to playback store.
  - Modify: `src/lib/playback/store.ts`
  - Add state:
    - `pendingSeekPosition: number | null`
    - `pendingSeekStartedAt: number`
  - Add actions:
    - `beginPendingSeek(seconds: number): void`
    - `clearPendingSeek(): void`
  - Rules:
    - Pending seek is runtime-only, not persisted.
    - Pending seek clamps to `[0, playback.duration]`.

- [ ] **1.2** Add tests for seek-pending behavior.
  - Modify: `src/lib/playback/store.test.ts`
  - Cases:
    - pending seek overrides displayed position immediately.
    - incoming backend position near pending target clears pending seek.
    - timeout clears stale pending seek after 1500ms.

- [ ] **1.3** Route `MainView.handleSeek()` through optimistic pending state.
  - Modify: `src/views/MainView.tsx`
  - On seek release:
    - call `beginPendingSeek(positionSeconds)`.
    - call `source?.seekTo(positionSeconds)`.
  - Display position should prefer pending seek while active.

- [ ] **1.4** Keep `ProgressRing` local scrubbing behavior but avoid post-release snapback.
  - Modify: `src/components/ProgressRing/index.tsx`
  - Ensure `isScrubbing` ends on pointer up.
  - Parent `position` prop supplies optimistic pending value after release.

- [ ] **1.5** Add command failure safety.
  - Modify: `src/lib/playback/tauriSource.ts` only if current command API exposes enough signal without violating event-authority rule.
  - If not enough signal, rely on timeout; do not make command response authoritative.

### Automated Checkpoint 1

- `npm run test:frontend -- store`
- `npm run build`
- `git diff --check -- src/lib/playback/store.ts src/views/MainView.tsx src/components/ProgressRing/index.tsx`

### Manual Checkpoint 1

- Play Spotify/browser media with seek support.
- Drag ring to a later timestamp.
- Expected: ring and tooltip stay at selected timestamp; no visible blink back to old timestamp.
- Release several seeks rapidly.
- Expected: no stuck pending state; backend resync wins after real seek settles.

---

## PHASE 2 — Direction-Aware Track Change State

> Goal: one small direction signal powers TrackInfo slide direction and vinyl reverse/forward transition.

- [ ] **2.1** Define track transition direction type.
  - Create: `src/lib/trackTransition/types.ts`
  - Type: `TrackChangeDirection = "next" | "previous" | "unknown"`.

- [ ] **2.2** Add runtime track transition metadata to store.
  - Modify: `src/lib/playback/store.ts`
  - Add:
    - `trackChangeDirection: TrackChangeDirection`
    - `trackChangeNonce: number`
  - Add action:
    - `markTrackChangeIntent(direction: TrackChangeDirection): void`
  - On `updatePlayback`, preserve latest intent for one semantic track change, then reset to `"unknown"`.

- [ ] **2.3** Mark intents from controls and shortcuts.
  - Modify: `src/views/MainView.tsx`
  - Modify: `src/views/MiniView.tsx`
  - Modify: `src/hooks/useKeyboardShortcuts.ts`
  - Before `source.next()`, call `markTrackChangeIntent("next")`.
  - Before `source.previous()`, call `markTrackChangeIntent("previous")`.

- [ ] **2.4** Add store tests.
  - Modify: `src/lib/playback/store.test.ts`
  - Cases:
    - next intent survives until incoming different track.
    - previous intent survives until incoming different track.
    - repeated same track update does not consume intent.
    - unknown source-driven track change uses `"unknown"`.

### Automated Checkpoint 2

- `npm run test:frontend -- store`
- `npm run build`

### Manual Checkpoint 2

- Click Next and Previous in main.
- Press Right/Left shortcut.
- Expected: no visible behavior change yet except no regressions.

---

## PHASE 3 — Directional TrackInfo Fade-Slide

> Goal: Next slides old text left/new text from right. Previous slides old text right/new text from left.

- [ ] **3.1** Thread direction into `TrackInfo`.
  - Modify: `src/components/TrackInfo/index.tsx`
  - Add prop: `direction?: TrackChangeDirection`.
  - Default: `"unknown"`.

- [ ] **3.2** Implement variants.
  - Modify: `src/components/TrackInfo/index.tsx`
  - For next:
    - enter `x: 24`, exit `x: -24`.
  - For previous:
    - enter `x: -24`, exit `x: 24`.
  - For unknown:
    - enter `x: 0`, exit `x: 0`, fade only.
  - Keep duration around 260-320ms, easing `[0.16, 1, 0.3, 1]`.

- [ ] **3.3** Keep layout stable.
  - Modify: `src/components/TrackInfo/TrackInfo.css`
  - Ensure single-line ellipsis still holds.
  - No width/height animation.

- [ ] **3.4** Wire `MainView` and `MiniView`.
  - Modify: `src/views/MainView.tsx`
  - Modify: `src/views/MiniView.tsx`
  - Pass `trackChangeDirection` from store.

### Automated Checkpoint 3

- `npm run build`
- `git diff --check -- src/components/TrackInfo/index.tsx src/components/TrackInfo/TrackInfo.css src/views/MainView.tsx src/views/MiniView.tsx`

### Manual Checkpoint 3

- Click Next.
- Expected: old title exits left, new title enters from right.
- Click Previous.
- Expected: old title exits right, new title enters from left.
- Let external player change track.
- Expected: fade-only or neutral motion, no wrong directional lie.

---

## PHASE 4 — Vinyl Prev/Next Direction Motion

> Goal: track skip gives the vinyl a tactile directional cue without fighting RAF rotation.
>
> Constraint: current `useVinylRotation` owns continuous rotation through direct DOM mutation; skip animation must not permanently reset or corrupt rotation.

- [ ] **4.1** Extend `useVinylRotation` API for skip impulse.
  - Modify: `src/hooks/useVinylRotation.ts`
  - Add optional inputs:
    - `skipDirection?: TrackChangeDirection`
    - `skipNonce?: number`
  - Internals:
    - When nonce changes and direction is next/previous, add temporary velocity impulse.
    - Next impulse: positive.
    - Previous impulse: negative.
    - Decay impulse over about 450-700ms.

- [ ] **4.2** Keep CSS transform single-owner.
  - Modify: `src/hooks/useVinylRotation.ts`
  - Final transform remains one string written by hook:
    - `rotate(${rotationRef.current}deg)`
  - Do not add competing Motion/CSS rotation to `.vinyl-disc`.

- [ ] **4.3** Wire impulse into `VinylRecord`.
  - Modify: `src/components/VinylRecord/index.tsx`
  - Add props:
    - `trackChangeDirection?: TrackChangeDirection`
    - `trackChangeNonce?: number`
  - Pass to `useVinylRotation`.

- [ ] **4.4** Wire views.
  - Modify: `src/views/MainView.tsx`
  - Modify: `src/views/MiniView.tsx`
  - Pass direction/nonce from store to `VinylRecord`.

- [ ] **4.5** Add pure rotation helper tests if helper is extracted.
  - Preferred create: `src/hooks/useVinylRotation.test.ts` or helper in `src/lib/vinyl/rotationMath.ts`
  - Cases:
    - next impulse increases velocity.
    - previous impulse briefly reverses or brakes velocity.
    - impulse decays to zero.

### Automated Checkpoint 4

- `npm run test:frontend`
- `npm run build`

### Manual Checkpoint 4

- Click Next while playing.
- Expected: vinyl gives forward kick, then returns to normal 33 RPM feel.
- Click Previous while playing.
- Expected: vinyl visibly brakes/reverses briefly, then resumes normal spin.
- Pause, click next/previous from external player if possible.
- Expected: no runaway rotation and no transform reset jump.

---

## PHASE 5 — Tonearm Completeness Pass

> Goal: adapt the master cinematic tonearm/needlearm qualities to current themed React/CSS implementation.

- [ ] **5.1** Inspect master reference directly.
  - Read: `stitch-ui-designs/stitch_vinyldeck_cinematic_analog_visualizer/vinyldeck_master_cinematic_experience/code.html`
  - View: `stitch-ui-designs/stitch_vinyldeck_cinematic_analog_visualizer/vinyldeck_master_cinematic_experience/screen.png`
  - Extract exact concepts:
    - arm geometry.
    - pivot/hinge.
    - headshell/cartridge.
    - stylus/needle.
    - brushed metal gradients.
    - shadows/depth.
    - play/pause/skip motion.

- [ ] **5.2** Compare current implementation.
  - Read: `src/components/NeedleArm/index.tsx`
  - Read: `src/components/NeedleArm/NeedleArm.css`
  - List gaps before editing in implementation notes.

- [ ] **5.3** Add missing DOM pieces only if needed.
  - Modify: `src/components/NeedleArm/index.tsx`
  - Likely pieces:
    - pivot cap.
    - counterweight.
    - arm tube.
    - headshell.
    - cartridge.
    - stylus point.
  - Keep aria-hidden decorative pieces.

- [ ] **5.4** Theme-adapt material CSS.
  - Modify: `src/components/NeedleArm/NeedleArm.css`
  - Use CSS vars only for colors:
    - `--needle-color`
    - `--needle-hinge-color`
    - `--needle-shadow`
    - `--ui-accent`
  - Noir: brushed silver over black.
  - Glass: brighter refractive metal with soft blue edge.
  - Do not hard-copy Tailwind utility tokens from reference.

- [ ] **5.5** Preserve existing approved behavior.
  - Play: arm drops.
  - Pause: arm stays in groove.
  - Next/Previous: lift, pause, re-drop, bump.
  - Empty: home position.

- [ ] **5.6** Verify no layout occlusion.
  - Tonearm must not cover label center in normal state.
  - Mini mode can hide/simplify tonearm if current mini layout lacks space; do not force full arm into mini unless visually clean.

### Automated Checkpoint 5

- `npm run build`
- `git diff --check -- src/components/NeedleArm/index.tsx src/components/NeedleArm/NeedleArm.css`

### Manual Checkpoint 5

- Compare app against master screenshot.
- Expected: tonearm reads as complete physical object, not abstract stick.
- Test Noir and Glass.
- Test empty, playing, paused, next, previous.

---

## PHASE 6 — Shadcn-Style Tooltip And Kbd Primitives

> Goal: local pure React/CSS primitives inspired by shadcn docs, no Tailwind, no dependency unless approved.

- [ ] **6.1** Create Kbd primitive.
  - Create: `src/components/Kbd/index.tsx`
  - Create: `src/components/Kbd/Kbd.css`
  - Components:
    - `Kbd`
    - `KbdGroup`
  - Styling:
    - mono font.
    - small inset keycap.
    - theme-aware border/background.
    - readable in Noir/Glass.

- [ ] **6.2** Create Tooltip primitive.
  - Create: `src/components/Tooltip/index.tsx`
  - Create: `src/components/Tooltip/Tooltip.css`
  - API:
    - `Tooltip`
    - `TooltipTrigger`
    - `TooltipContent`
  - Behavior:
    - hover and focus open.
    - Escape closes.
    - no tooltip while disabled button is unfocusable; wrap disabled visual with span when needed.
    - pointer-events safe.

- [ ] **6.3** Add placement safety.
  - Tooltip content uses fixed positioning or viewport-clamped absolute coordinates.
  - Must not overflow screen edges.
  - Keep simple placements first: top, bottom.

- [ ] **6.4** Use tooltips on existing icon controls.
  - Modify: `src/components/Controls/index.tsx`
  - Modify: `src/views/MainView.tsx`
  - Add tooltips:
    - Previous `Left`
    - Play/Pause `Space`
    - Next `Right`
    - Settings.
  - Do not add visible instructional text to main UI.

- [ ] **6.5** Use Kbd in Settings ABOUT/shortcuts surface only if it stays compact.
  - Modify: `src/components/Settings/index.tsx`
  - Show current shortcuts as passive reference, not editing UI.
  - If cramped, defer to context menu only.

### Automated Checkpoint 6

- `npm run build`
- `git diff --check -- src/components/Tooltip src/components/Kbd src/components/Controls/index.tsx src/views/MainView.tsx`

### Manual Checkpoint 6

- Hover/focus controls.
- Expected: tooltip appears without layout shift.
- Move near viewport edges.
- Expected: tooltip stays visible and readable.
- Switch Noir/Glass.
- Expected: keycaps/tooltips match theme.

---

## PHASE 7 — Keyboard Shortcuts Toggle

> Goal: user can disable focused-window shortcuts without removing existing shortcut code.

- [ ] **7.1** Extend settings contract.
  - Modify: `src/lib/settings/types.ts`
  - Add: `keyboardShortcutsEnabled: boolean`
  - Default: `true`.

- [ ] **7.2** Extend frontend validation.
  - Modify: `src/lib/settings/index.ts`
  - Validate boolean; fallback true.

- [ ] **7.3** Extend Rust settings authority.
  - Modify: `src-tauri/src/settings/mod.rs`
  - Add serde field `keyboard_shortcuts_enabled`.
  - Default true.
  - Patch support.
  - Tests:
    - invalid value falls back true.
    - patch false persists false.

- [ ] **7.4** Gate shortcut hook.
  - Modify: `src/hooks/useKeyboardShortcuts.ts`
  - If disabled:
    - allow `Escape` to close Settings if settings open.
    - allow no playback/window/theme shortcuts.
    - consider keeping `Ctrl+Q` disabled too because user asked for shortcuts toggle; explicit tray/menu quit remains available.

- [ ] **7.5** Add Settings DISPLAY toggle.
  - Modify: `src/components/Settings/index.tsx`
  - Label: `Keyboard Shortcuts`
  - Description: `Focused-window playback and window shortcuts.`
  - Toggle via `commitSettings({ keyboardShortcutsEnabled: !settings.keyboardShortcutsEnabled })`.

- [ ] **7.6** Update docs.
  - Modify: `docs/USER_GUIDE.md`
  - Mention toggle under Settings.

### Automated Checkpoint 7

- `npm run build`
- `npm run test:frontend`
- `cargo test --manifest-path src-tauri/Cargo.toml settings`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

### Manual Checkpoint 7

- Toggle shortcuts off.
- Press Space/Left/Right/F/M/T/A/Ctrl+Q.
- Expected: no action.
- Open Settings, press Escape.
- Expected: settings closes.
- Toggle shortcuts on.
- Expected: shortcuts work again.

---

## PHASE 8 — Quit-To-Tray Toggle

> Goal: user can choose whether window X hides to tray or exits app.
>
> Note: current close behavior always hides main/mini to tray.

- [ ] **8.1** Extend settings contract.
  - Modify: `src/lib/settings/types.ts`
  - Add: `quitToTray: boolean`
  - Default: `true`.

- [ ] **8.2** Extend frontend validation.
  - Modify: `src/lib/settings/index.ts`
  - Validate boolean; fallback true.

- [ ] **8.3** Extend Rust settings authority.
  - Modify: `src-tauri/src/settings/mod.rs`
  - Add serde field `quit_to_tray`.
  - Default true.
  - Patch support.
  - Tests:
    - invalid value falls back true.
    - patch false persists false.

- [ ] **8.4** Make close handler respect setting.
  - Modify: `src-tauri/src/tray.rs`
  - In `handle_window_close`, read `SettingsState`.
  - If `quit_to_tray` true: current behavior, prevent close and hide.
  - If false: allow close for main/mini OR call explicit quit for process consistency.
  - Preferred behavior: explicit app quit through `app_lifecycle::quit()` when main closes and quit-to-tray is false.

- [ ] **8.5** Add Settings DISPLAY toggle.
  - Modify: `src/components/Settings/index.tsx`
  - Label: `Quit To Tray`
  - Description: `Close button hides VinylDeck instead of exiting.`
  - Toggle via backend settings.

- [ ] **8.6** Update tests.
  - Modify: `src-tauri/src/tray.rs`
  - Pure helper test:
    - close main with setting true => hide.
    - close main with setting false => quit.
    - non-player windows not intercepted.

- [ ] **8.7** Update docs.
  - Modify: `docs/USER_GUIDE.md`
  - Modify: `docs/TROUBLESHOOTING.md`

### Automated Checkpoint 8

- `cargo test --manifest-path src-tauri/Cargo.toml tray`
- `cargo test --manifest-path src-tauri/Cargo.toml settings`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `npm run build`

### Manual Checkpoint 8

- Quit To Tray ON: click X.
- Expected: window hides; tray Open restores.
- Quit To Tray OFF: click X.
- Expected: app process exits.
- Reopen app.
- Expected: toggle persists.

---

## PHASE 9 — Custom Context Menu

> Goal: right-click menu matching VinylDeck material language, with useful playback/window/settings actions.

- [ ] **9.1** Create context menu primitive.
  - Create: `src/components/AppContextMenu/index.tsx`
  - Create: `src/components/AppContextMenu/AppContextMenu.css`
  - Behavior:
    - open on `contextmenu`.
    - position at pointer.
    - viewport clamp.
    - close on outside click, Escape, scroll, window resize.
    - keyboard navigation: ArrowUp/ArrowDown, Enter, Escape.

- [ ] **9.2** Menu content.
  - Actions:
    - Play/Pause with `Space` Kbd.
    - Previous with `Left` Kbd.
    - Next with `Right` Kbd.
    - Toggle Art Ambient with `A` Kbd.
    - Toggle Fullscreen with `F` Kbd.
    - Mini Player with `M` Kbd.
    - Settings.
    - Quit.
  - Disable playback items according to capabilities.

- [ ] **9.3** Wire to MainView and MiniView root.
  - Modify: `src/views/MainView.tsx`
  - Modify: `src/views/MiniView.tsx`
  - Main menu can open Settings.
  - Mini menu can return to main or open mini-safe actions.

- [ ] **9.4** Use existing command paths.
  - Playback: `source` methods.
  - Settings: local `setIsSettingsOpen(true)` in Main.
  - Window modes: `commitSettings()` then `setNativeWindowMode()`.
  - Quit: `quitApplication()`.

- [ ] **9.5** Theme styling.
  - Noir: matte black lacquer, subtle border, no watery glass.
  - Glass: LiquidGlass-style lens if it stays readable.
  - Use Kbd component for shortcuts.

### Automated Checkpoint 9

- `npm run build`
- `git diff --check -- src/components/AppContextMenu src/views/MainView.tsx src/views/MiniView.tsx`

### Manual Checkpoint 9

- Right-click main.
- Expected: menu appears at pointer, clamped to viewport.
- Keyboard navigate with arrows/Enter/Escape.
- Disabled playback items visibly disabled and non-clickable.
- Right-click mini.
- Expected: menu works without breaking drag behavior.

---

## PHASE 10 — Final Integration And Documentation

> Goal: verify tasks 2-9 together and record new state.

- [ ] **10.1** Full automated suite.
  - Run: `npm run build`
  - Run: `npm run test:frontend`
  - Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
  - Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - Run: `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] **10.2** Tauri live smoke.
  - Run: `npm run tauri dev`
  - Test with Spotify or browser media.
  - Check no console flood from failed SMTC commands.

- [ ] **10.3** Update living memory.
  - Modify: `.agents/memory/state.md`
  - Record:
    - scrub blink fix.
    - directional transitions.
    - tonearm pass.
    - tooltip/kbd/context menu.
    - shortcuts toggle.
    - quit-to-tray toggle.
    - verification output.

- [ ] **10.4** Update user docs.
  - Modify: `docs/USER_GUIDE.md`
  - Modify: `docs/API.md` if settings command payload changed.
  - Modify: `docs/TROUBLESHOOTING.md` for close behavior toggle.

- [ ] **10.5** Final git review.
  - Run: `git status --short`
  - Run: `git diff --stat`
  - Run: `git diff --check`
  - Do not commit unless user asks.

### Final Manual Checkpoint

- Scrub seek no longer blinks.
- Next/previous text moves correct direction.
- Vinyl gives directional next/previous physical cue.
- Tonearm visually complete in Noir and Glass.
- Tooltips and Kbd are theme-correct.
- Keyboard shortcut toggle works.
- Quit-to-tray toggle works.
- Context menu works in main and mini.

---

## Risk Register

| Risk                                                 | Likelihood | Impact | Mitigation                                                             |
| ---------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Dirty baseline build already broken                  | Medium     | High   | Phase 0 stops before implementation.                                   |
| Optimistic seek fights SMTC truth                    | Medium     | Medium | Timeout + clear on nearby backend position; backend remains authority. |
| Direction intent wrong for external track changes    | Medium     | Low    | External changes use `"unknown"` neutral fade.                         |
| Vinyl skip impulse fights RAF owner                  | Medium     | Medium | One hook owns final transform string.                                  |
| Tonearm overdraws label/controls                     | Medium     | Medium | Manual checkpoint across states and themes.                            |
| Tooltip/context menu focus traps annoy shortcuts     | Low        | Medium | Escape/outside-close rules and shortcut ignore checks.                 |
| Quit-to-tray false exits unexpectedly during testing | Low        | High   | Clear manual test steps; setting default stays true.                   |

## Open Decisions For Approval

1. **Quit To Tray OFF behavior:** preferred = clicking X exits whole app process, same as explicit Quit. Alternative = close current window only, but this risks hidden mini/main lifecycle weirdness.
   A: Same as explicit quit exits whole app on toggle off
2. **Context menu action list:** proposed actions are playback, Art Ambient, Fullscreen, Mini, Settings, Quit. Remove any item before implementation if too crowded.
   A: Cool
3. **Shortcut toggle scope:** proposed OFF disables all focused shortcuts except Escape closing Settings. Ctrl+Q also disabled. Explicit tray/menu Quit remains.
   A: Thats right only escape remains to close settings modal or exiting fullscreen rest all disable
4. **Mini tonearm:** proposed not to force full detailed tonearm into mini unless it fits cleanly.
   A: EXperiment later skip for now.
