# PRD-05 — VinylDeck: Build Sequence & Agent Execution Guide

**Version:** 1.0  
**Date:** 2026-06-08  
**Purpose:** Gives an AI coding agent (or a human developer) the exact order of operations to build VinylDeck from zero to working app without guesswork.

---

## The Rule

**Build in this order. Do not skip ahead. Do not build the media layer before the visual engine looks good.**

The visual engine is the product. Everything else is plumbing.

---

## Stage 0 — Environment Check (do this first, always)

```bash
# Verify all tools are present
node --version          # must be 20+
npm --version           # must be 10+
rustup show             # must show stable channel
cargo --version         # must be 1.79+
cargo tauri --version   # must be 2.x

# Windows only:
# Verify Windows SDK is installed (needed for WinRT bindings)
# Check: C:\Program Files (x86)\Windows Kits\10\Include\10.0.19041.0\winrt\

# If any tool is missing, stop and install it before proceeding.
```

---

## Stage 1 — Project Scaffold

```bash
npm create tauri-app@latest vinyldeck -- --template react-ts --manager npm
cd vinyldeck
npm install motion zustand @vibrant/core @tauri-apps/plugin-store
npm install --save-dev @types/node

# Add Rust deps
# Edit src-tauri/Cargo.toml — add ALL deps from PRD-03 Section 3.1
cargo add tauri-plugin-store --manifest-path src-tauri/Cargo.toml

# Verify it builds (even though it's empty)
npm run tauri build -- --debug
```

**Exit criteria:** App window opens. Shows Tauri default screen. No build errors.

---

## Stage 2 — Visual Engine with MockSource (NO real media yet)

**This entire stage uses MockSource only. Ignore SMTC completely.**

### 2a — Global CSS & Theme System

1. Create `src/styles/global.css` — base reset, `html { background: #000; }`, font stack
2. Create `src/styles/themes.css` — all 5 themes from PRD-02 Section 3.1 and 3.2
3. Create `src/styles/animations.css` — `@keyframes vinyl-spin` from PRD-02 Section 4.2
4. Import all three in `src/main.tsx`
5. Apply default theme: `document.documentElement.setAttribute("data-theme", "noir")`

**Exit criteria:** Open browser devtools → `:root` has all CSS custom properties. Change `data-theme` manually → colors change.

### 2b — VinylRecord Component

1. Create `src/components/VinylRecord/VinylRecord.css` — full CSS from PRD-02 Section 4.2
2. Create `src/components/VinylRecord/index.tsx` — component from PRD-02 Section 4.4
3. Create `src/hooks/useVinylRotation.ts` — hook from PRD-02 Section 4.3
4. Render it in `App.tsx` with hardcoded `isPlaying={true}` and no artwork

**Exit criteria:** Vinyl disc is visible on screen. It's spinning. Grooves are visible (radial gradient rings). Center label shows "B" fallback (no artwork).

### 2c — NeedleArm Component

1. Create `src/components/NeedleArm/NeedleArm.css` — CSS from PRD-02 Section 5.2
2. Create `src/components/NeedleArm/index.tsx` — Motion component from PRD-02 Section 5.3
3. Add to the layout next to the vinyl

**Exit criteria:** Needle arm is visible. Toggle `isPlaying` in React DevTools → arm smoothly rotates between 25° and 10°. Spring physics are visible (slight overshoot).

### 2d — AmbientLayer Component

1. Create `src/components/AmbientLayer/AmbientLayer.css` — CSS from PRD-02 Section 6.2
2. Create `src/components/AmbientLayer/index.tsx`
3. Place it as the first child in the layout (z-index 0, behind everything)
4. Use hardcoded `--ambient-primary: #1a0030` and `--ambient-secondary: #001a20` for testing

**Exit criteria:** Blurred color orbs are visible behind the vinyl. The background is not pure black — it has a subtle color glow.

### 2e — ProgressRing Component

1. Create `src/components/ProgressRing/index.tsx` — SVG ring from PRD-02 Section 7.2
2. Wire to hardcoded `duration={354}` and `position={87}` initially
3. Wrap vinyl + ring in a `position: relative` container

**Exit criteria:** A thin circle is visible around the vinyl, with an arc showing ~24% completion. No progress ring renders when `duration={0}`.

### 2f — TrackInfo Component

1. Create `src/components/TrackInfo/index.tsx` — AnimatePresence from PRD-02 Section 8.2
2. Render below the vinyl with hardcoded data

**Exit criteria:** Track title and artist are visible below the vinyl. Change the `key` prop in devtools → text cross-fades.

### 2g — Controls Component

1. Create `src/components/Controls/index.tsx` — three buttons from PRD-02 Section 9
2. Wire to MockSource callbacks (just log to console for now)

**Exit criteria:** Three buttons visible below track info. Hover shows background highlight. Click logs to console.

### 2h — MockSource Integration

1. Create `src/lib/playback/types.ts` — full interfaces from PRD-01 Section 6.1
2. Create `src/lib/playback/mockSource.ts` — full mock from PRD-03 Section 11
3. Create `src/lib/playback/store.ts` — Zustand store from PRD-03 Section 6
4. Wire MockSource → store → all components
5. Connect Controls buttons to `source.play()`, `source.pause()`, `source.next()`, etc.

**Exit criteria:** MockSource auto-plays. Track title updates when `source.next()` is called. Vinyl spins when `isPlaying=true`, slows to stop with inertia when `isPlaying=false`. Needle arm moves with play/pause.

### 2i — Theme Switching

1. Create `src/lib/themes/applier.ts` — `applyTheme()` from PRD-02 Section 3.3
2. Create `src/components/ThemePicker/index.tsx` — 5 buttons, one per theme
3. Wire to `useVinylDeckStore().setTheme()`

**Exit criteria:** Clicking each theme button changes the entire color palette instantly (CSS custom property swap). All 5 themes look distinct and intentional.

### 2j — Color Extraction

1. Create `src/hooks/useColorExtraction.ts` — PRD-02 Section 6.3
2. In `App.tsx`: when `artworkDataUrl` changes, run extraction, call `applyAmbientColors()`
3. Load a test artwork image to verify (use a local PNG in `/public/test-art.png`)

**Exit criteria:** When test artwork is loaded, ambient background changes to colors derived from the artwork. Color extraction takes < 200ms and doesn't visibly block the UI.

### 2k — MainView Layout (Final Composition)

1. Create `src/views/MainView.tsx` — compose all components in proper z-stack
2. Final layout hierarchy:
   ```
   <div class="app-root">           z: 0, full screen
     <AmbientLayer />               z: 0, fixed, behind
     <div class="content">          z: 1, centered, flex column
       <div class="vinyl-area">     position: relative
         <ProgressRing />
         <VinylRecord />
         <NeedleArm />
       </div>
       <TrackInfo />
       <Controls />
       <ThemePicker />
     </div>
     <SourceBadge />               z: 2, bottom-right corner
   </div>
   ```

**Exit criteria:** Full layout looks like the design reference. All elements are properly layered. Resize window → layout adapts gracefully (no overflow, no broken alignment).

**Stage 2 complete when:** The app looks beautiful with MockSource data. Show it to someone unfamiliar with the project. Their first reaction should be positive. If not, fix Stage 2 before moving to Stage 3.

---

## Stage 3 — Tauri Shell & Window Management

### 3a — Configure tauri.conf.json

Apply the full config from PRD-03 Section 3.2. Set correct window dimensions, title, icon.

**Exit criteria:** `npm run tauri dev` opens a native window. The app is not in a browser — it's a real desktop window.

### 3b — Settings Persistence

1. Register `tauri-plugin-store` in `main.rs`
2. Create `src/lib/settings.ts` from PRD-03 Section 10
3. On app start: `loadSettings()` → apply theme and window mode
4. On any setting change: `saveSettings()`

**Exit criteria:** Change theme → quit app → reopen → same theme is active.

### 3c — Window Modes

1. Create `src-tauri/src/window/mod.rs` — commands from PRD-03 Section 7.2
2. Register commands in `main.rs`
3. Create `src/lib/windowMode.ts` from PRD-03 Section 7.3
4. Wire keyboard shortcut `F` to toggle fullscreen, `M` to toggle mini

**Exit criteria:** Press `F` → app goes fullscreen (borderless). Press `F` again → returns to windowed. Press `M` → small 280×280 always-on-top window appears.

### 3d — System Tray

1. Create `src-tauri/src/tray.rs` from PRD-03 Section 8
2. Hook into `setup()` in `main.rs`

**Exit criteria:** VinylDeck icon appears in Windows system tray. Right-click shows menu. "Quit VinylDeck" exits the app. Closing the main window hides to tray rather than quitting.

### 3e — Keyboard Shortcuts

1. Create `src/hooks/useKeyboardShortcuts.ts` from PRD-03 Section 9.2
2. Mount in `App.tsx`

**Exit criteria:** All keyboard shortcuts from PRD-03 Section 9.1 work correctly.

**Stage 3 complete when:** The Tauri app is fully functional as a shell, with window modes, tray, keyboard shortcuts, and settings all working — still using MockSource.

---

## Stage 4 — SMTC Media Integration (Windows)

### 4a — SMTC Reader

1. Add `windows` crate to `Cargo.toml` with the features from PRD-03 Section 3.1
2. Create `src-tauri/src/media/smtc.rs` — full implementation from PRD-03 Section 4.1
3. Verify it compiles: `cargo build --manifest-path src-tauri/Cargo.toml`

**Exit criteria:** `cargo build` succeeds. No linker errors. (It won't do anything yet — that's fine.)

### 4b — Polling Loop

1. Create `src-tauri/src/media/mod.rs` — polling from PRD-03 Section 4.2
2. Call `start_media_polling(app.handle().clone())` from `main.rs` setup()

**Exit criteria:** With Spotify playing, check console output in `npm run tauri dev` → should see the poll loop running every 500ms. Log `snapshot` to verify it's populated.

### 4c — Tauri Commands

1. Create `src-tauri/src/media/commands.rs` — all commands from PRD-03 Section 4.3
2. Register them in `main.rs` `generate_handler![]`

**Exit criteria:** Open Tauri devtools → manually call `window.__TAURI__.core.invoke("cmd_get_media_snapshot")` → returns JSON with track data from Spotify.

### 4d — TauriSource Frontend Adapter

1. Create `src/lib/playback/tauriSource.ts` from PRD-03 Section 5
2. In `App.tsx`: use `createTauriSource()` instead of `createMockSource()` when `!import.meta.env.DEV`

**Exit criteria:** With Spotify playing, VinylDeck shows the real track title, artist, and album. Vinyl spins. Background glows with extracted album colors.

### 4e — Artwork Display and Color Extraction

**This is where it comes together. The first time you see real album art in the vinyl label with a matching ambient glow, that's the moment.**

**Exit criteria:**
- Album art appears in the vinyl center label
- `useColorExtraction` extracts colors from it
- Ambient background matches the album art palette
- Track changes in Spotify → VinylDeck updates within 500ms

### 4f — Playback Control

1. Wire Controls buttons to Tauri commands (play/pause/skip)
2. Test: click Play/Pause in VinylDeck → Spotify plays/pauses
3. Test: click Next → Spotify skips to next track

**Exit criteria:** All three control buttons work correctly with Spotify. Test with YouTube Music in Chrome. Test with VLC.

**Stage 4 complete when:** VinylDeck is a fully functional media companion on Windows. Open any music app, play a song, VinylDeck shows it beautifully. All the animation states work correctly.

---

## Stage 5 — Polish Pass

This stage is not about adding features. It's about making what exists feel premium.

### Polish Checklist

Go through every animation. Ask: does it feel physical? Does it feel Apple-quality?

- [ ] Needle arm spring — does the overshoot feel right? Adjust `stiffness` and `damping`
- [ ] Vinyl inertia on pause — does it decelerate like a real record? Or too fast/slow?
- [ ] Ambient color transition — smooth? Or jarring?
- [ ] Track change crossfade — does the old artwork blur out gracefully?
- [ ] Glow intensity — is it atmospheric or overwhelming?
- [ ] Typography — is the spacing generous enough? Does it breathe?
- [ ] Theme Noir — is it cinematic enough? Or just dark grey?
- [ ] Theme Glass — does the frosted glass effect work?
- [ ] Mini player — does it feel like a luxury gadget?
- [ ] Empty state — is it calm and inviting?

**There is no definition of done for Stage 5.** You know it when you feel it.

---

## Stage 6 — Build and Ship Phase 1

```bash
npm run tauri build

# Outputs:
# src-tauri/target/release/bundle/msi/VinylDeck_0.1.0_x64_en-US.msi
# src-tauri/target/release/bundle/nsis/VinylDeck_0.1.0_x64-setup.exe
```

Test the installer on a clean Windows machine. Verify WebView2 bootstrapper works for Windows 10 users.

---

## Critical Mistakes to Avoid

### Mistake 1: Starting with SMTC before the visual engine is beautiful
**Effect:** You'll spend weeks on media plumbing and never fix the animations. The app will ship looking mediocre.  
**Fix:** Stage 2 must look great before Stage 4 begins.

### Mistake 2: Animating layout properties
**Effect:** Dropped frames, janky animations, GPU thrashing.  
**Fix:** Only animate `transform` and `opacity` via JS/Motion. Use CSS transitions for color. Never animate `width`, `height`, `top`, `left`.

### Mistake 3: Using `framer-motion` (old package name)
**Effect:** Import errors, wrong API.  
**Fix:** `npm install motion`. Import from `"motion/react"`.

### Mistake 4: Blocking on artwork fetch before rendering
**Effect:** Visible delay between track change and UI update.  
**Fix:** Update track info immediately with text data. Artwork loads asynchronously and fades in when ready. Never block.

### Mistake 5: Using `animation-play-state: paused` for the vinyl stop
**Effect:** Vinyl stops instantly with no inertia. Feels wrong.  
**Fix:** Use `useVinylRotation` hook which smoothly interpolates velocity to 0.

### Mistake 6: Setting up WinRT event subscriptions (instead of polling)
**Effect:** Complex threading issues with COM STA apartments in Rust. Crashes or deadlocks.  
**Fix:** Poll every 500ms. It's reliable, simple, and fast enough.

### Mistake 7: Hard-coding colors in component CSS
**Effect:** Theme switching doesn't work. Every color change requires code changes.  
**Fix:** Every color value comes from a CSS custom property. No hard-coded hex in components.

### Mistake 8: Building mobile before desktop is stable
**Effect:** Debugging two platforms simultaneously. Neither works well.  
**Fix:** Phase 1 (Windows desktop) must be shipped and stable before Phase 2 (mobile) begins.

---

## Quick Reference: All Files to Create

### Frontend (src/)
```
src/main.tsx                            (entry point)
src/App.tsx                             (root component)
src/styles/global.css
src/styles/themes.css
src/styles/animations.css
src/lib/playback/types.ts
src/lib/playback/store.ts
src/lib/playback/tauriSource.ts
src/lib/playback/mockSource.ts
src/lib/color/extractor.ts
src/lib/themes/applier.ts
src/lib/themes/types.ts
src/lib/settings.ts
src/lib/platform.ts
src/lib/windowMode.ts
src/components/VinylRecord/index.tsx
src/components/VinylRecord/VinylRecord.css
src/components/NeedleArm/index.tsx
src/components/NeedleArm/NeedleArm.css
src/components/AmbientLayer/index.tsx
src/components/AmbientLayer/AmbientLayer.css
src/components/ProgressRing/index.tsx
src/components/TrackInfo/index.tsx
src/components/Controls/index.tsx
src/components/ThemePicker/index.tsx
src/components/SourceBadge/index.tsx
src/components/MiniPlayer/index.tsx
src/views/MainView.tsx
src/views/FullscreenView.tsx
src/views/MiniView.tsx
src/views/PermissionPromptView.tsx      (mobile only)
src/hooks/useVinylRotation.ts
src/hooks/useColorExtraction.ts
src/hooks/useKeyboardShortcuts.ts
src/hooks/useMobileGestures.ts         (mobile only)
src/hooks/usePlayback.ts
```

### Rust Backend (src-tauri/src/)
```
src-tauri/src/main.rs
src-tauri/src/lib.rs
src-tauri/src/media/mod.rs
src-tauri/src/media/smtc.rs            (Windows)
src-tauri/src/media/commands.rs
src-tauri/src/window/mod.rs
src-tauri/src/tray.rs
```

### Config
```
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
src-tauri/capabilities/default.json
```
