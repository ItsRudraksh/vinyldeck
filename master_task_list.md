# VinylDeck — Master Implementation Task List
> Generated from deep_design_synthesis.md + all DESIGN.md tokens + current state.md
> All vinyl shapes: CIRCLE ONLY (no square/diamond disc shapes from mock designs)
> State coverage required on every visual task: empty · playing · paused · scrubbing · hover · click · next · prev

---

## How to Execute This List

Each task is **atomic** — one concern, one file group, one manual test.  
Execute **sequentially within a phase**. Phases within the same tier can be parallelized with subagents.  
Every phase ends with a **🧪 Manual Checkpoint** — do not start the next phase until checkpoint passes.

---

## PHASE 0 — Foundation Repair ✅ COMPLETE
> All token vars, fonts, radius, color-scheme wired up.

- [x] **0.1** `themes.css` — all 5 themes have `--bg`, token values correct (Noir `#131313`, Aurora `#0e1419`, Vapor `#111225`, Paper `#fef9eb`, Glass `#f9f9fb`)
- [x] **0.2** `--radius-base: 0` on Noir theme (zero everywhere except disc circle)
- [x] **0.3** `global.css` — all 8 theme fonts imported (Hanken Grotesk, Geist, Anybody, Space Grotesk, Space Mono, Libre Caslon Text, Work Sans, Manrope)
- [x] **0.4** Per-theme `--font-display`, `--font-body`, `--font-mono` CSS vars. `body`/`h1-h6` use `var(--font-body/display)` — theme-controlled
- [x] **0.5** Paper + Glass have `color-scheme: light` — OS scrollbars + inputs render light

### 🧪 Checkpoint 0 ✅
- Backgrounds correct per theme, typography correct per theme, build clean

---

## PHASE 1 — Ambient Layer ✅ COMPLETE
> Orbs float, breathe, center heartbeat added.

- [x] **1.1** `@keyframes floatOrb-a/b` — 23s/19s staggered drift, orbs never sync
- [x] **1.2** Orbs use `mix-blend-mode: screen`, background uses `var(--bg)`
- [x] **1.3** Center heartbeat orb — 30vw, 60px blur, `breathe-center` 6s alternate, behind disc
- [x] **1.4** Grain — 3.5% opacity, mix-blend: overlay, grain-shift 0.12s steps, top layer
- [x] **1.5** Paper/Glass light-mode vignette override (rgba dark values → very light)

### 🧪 Checkpoint 1 ✅
- Orbs drift slowly, center orb pulses, grain texture visible, Paper/Glass background correct

---

## PHASE 2 — Vinyl Record Physics ✅ COMPLETE
> Wobble, counter-rotating reflections, tuned specular.

- [x] **2.1** `@keyframes vinylWobble` — ±0.8px translate + 0.001 scale variance, 1.8s linear, applied via `.vinyl-wrapper--playing` (doesn't interfere with RAF rotation)
- [x] **2.2** `vinyl-sheen` stays INSIDE `vinyl-disc` (mouse-driven, correct). Counter-rotate layers moved outside.
- [x] **2.3** `vinyl-counter-a/b` OUTSIDE `vinyl-disc` — fixed-angle environmental light. 6s CW + 8s CCW. Opacity 0.4/0.3 paused → 0.75/0.65 playing
- [x] **2.4** Mouse specular opacity lifted from `0.07` → `0.28` — now visible
- [x] **2.5** Wobble only when `isPlaying` — `.vinyl-wrapper--playing` class gated
- [x] **2.6** Empty state: no `--playing` class → no wobble, no spin

### 🧪 Checkpoint 2 ✅
- Disc wobbles when playing, stops when paused, counter-rotation visible, specular follows mouse

---

## PHASE 3 — Tonearm Micro-Details ✅ COMPLETE
> LED theme-colored, needle bump, track-skip lift/re-drop.

- [x] **3.1** LED uses `var(--ui-accent)` — Noir→white, Aurora→teal, Vapor→magenta, Paper→bronze, Glass→blue. `ledPulse` keyframe (global). Dim via `color-mix()`.
- [x] **3.2** Needle bump — `needle-arm__head--bump` flashes `needleBump` keyframe (120ms, -3px → 0) when arm settles on groove after play or skip
- [x] **3.3** Track skip sequence — `trackKey` prop + `useAnimation` controls: lift(30°) → 280ms pause → re-drop(10°) → bump
- [x] **3.4** `MainView` wires `trackKey={playback.track}` to `NeedleArm`
- [x] **3.5** Arm stays in groove when paused (only lifts on next/prev/skip — not on pause)
- [x] **3.6** Arm at home (25°) when empty/no track, LED still pulses (powered on)

### 🧪 Checkpoint 3
- **Play:** Arm drops with spring bounce, LED glows in theme color
- **Pause:** Arm stays in groove (does NOT lift)
- **Next/Prev:** Arm lifts, pauses, re-drops with bump
- **Empty:** Arm at home 25°, LED dim-pulsing

---

## PHASE 4 — Controls & Interaction States ✅ COMPLETE
> Glassmorphism pill, icon morph, all states wired.

- [x] **4.1** Glassmorphism pill `.controls-pill` — `backdrop-filter: blur(20px) saturate(1.4)`, `--ui-bg/border`, always `border-radius: 9999px`
- [x] **4.2** Secondary buttons (Prev/Next) — hover: `--ui-text-primary` + `--ui-control-hover` bg; active: `scale(0.88)`; disabled: `opacity: 0.28`, `cursor: not-allowed`
- [x] **4.3** Primary button — paused (base shadow), playing (accent ring + glow bloom), hover (`scale(1.06)` + stronger glow), active (`scale(0.88)`), disabled (`opacity: 0.30`)
- [x] **4.4** Icon morph via `AnimatePresence mode="popLayout"` — exit: scale→0.55 + fade 140ms easeIn; enter: scale→1 + fade 180ms backOut
- [x] **4.5** Paper→cream icon on bronze bg, Glass→white icon on blue bg (light-mode contrast)
- [x] **4.6** All styling in `Controls.css` — no inline style objects

### 🧪 Checkpoint 4
- **Empty:** Buttons at 0.28 opacity, cursor not-allowed
- **Playing → Pause:** Icon morphs (scale-out, scale-in), glow fades from play button
- **Paused → Play:** Icon morphs back, glow blooms on play button
- **Hover Prev/Next:** Scale 1.10 + color lifts to primary
- **Click:** Scale snaps to 0.88, springs back
- **Switch to Vapor:** Play button glow turns magenta

---

## PHASE 5 — Track Info & Typography States ✅ COMPLETE
> Per-theme fonts, animated slide transitions.

- [x] **5.1** Per-theme font vars: title→`var(--font-display)` `clamp(18-28px)` weight 700; artist→`var(--font-body)` 13px uppercase tracking; album→`var(--font-mono)` 11px muted stamp
- [x] **5.2** Empty state — `"— / —"` in `var(--font-mono)` at 50% opacity, AnimatePresence fade (no layout shift)
- [x] **5.3** Track change transition — exit slides LEFT `x:-24px + fade 300ms`, enter from RIGHT `x:24px→0 + fade 300ms`, easing `[0.16, 1, 0.3, 1]`
- [x] **5.4** Single-line ellipsis on all rows — `text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`
- [x] **5.5** Title hover bloom — `text-shadow: 0 0 16px var(--ui-accent)` on `:hover` (CSS only, no JS)
- [x] **5.6** Paper serif override — Caslon at `font-weight: 400`, slight size reduction, `letter-spacing: -0.01em`

### 🧪 Checkpoint 5
- **All 5 themes:** Title in correct font (Hanken Grotesk/Noir, Sora/Aurora, Anybody/Vapor, Caslon/Paper, Manrope/Glass)
- **Next track:** Text slides out left, new text slides in from right
- **Long title:** Ellipsis, no overflow
- **Empty:** `"— / —"` placeholder visible, no crash

---

## PHASE 6 — Theme-Specific Visual Layers ✅ COMPLETE
> Each theme has unique background character. Vinyl stays circle.

- [x] **6.1** **Noir** — confirmed `#131313` bg, FAC color drives primary orb. No artwork → white orb at 5% opacity.
- [x] **6.2** **Aurora** — `auroraShift` keyframe on `.ambient-layer` bg: `135deg linear-gradient` (navy→teal→navy) animating `background-size: 400% 400%` over 20s.
- [x] **6.3** **Vapor** — `<VaporGrid />` component: perspective(600px) rotateX(62deg) grid, dual `linear-gradient` line pattern, `moveGrid` 3s linear infinite, horizon glow line. Only renders in Vapor theme.
- [x] **6.4** **Paper** — orbs hidden, `::before` warm radial glow from top `rgba(212,168,64,0.18)`, `panLight` 22s drift, grain at 5.5%.
- [x] **6.5** **Glass** — orbs set to soft pastel blobs (purple/teal/rose at 6-8% opacity, 80-100px blur), grain disabled (clean surface).
- [x] **6.6** **Theme vinyl labels**: Noir→iridescent conic shimmer (counterRotateA), Aurora→cyan ring border + glow + inner concentric ring, Vapor→`color-mix()` magenta tint + neon shadow, Paper→aged white label + stamped "33⅓ RPM · STEREO" text, Glass→`backdrop-filter: blur(6px)` frosted circle.

### 🧪 Checkpoint 6
- **All 5 themes:** Visually distinct background on switch
- **Vapor:** Grid floor visible + animating, horizon glow line
- **Aurora:** Bg breathes/shifts between teal tones
- **Paper:** Cream bg, warm top glow, no dark orbs visible
- **Glass:** White-ish bg, subtle pastel blobs, no grain
- **Each theme:** Vinyl center label matches identity

---

## PHASE 7 — Idle (Lean-Back) Mode ✅ COMPLETE
> 3s inactivity timer, UI fades, cursor hides.

- [x] **7.1** `useIdleMode` hook — `mousemove`/`mousedown` listeners, `setTimeout(3000)`, returns `isIdle: boolean`
- [x] **7.2** `isIdle === true`: Controls, TrackInfo, ThemePicker, ProgressRing → `opacity:0`, `pointer-events:none`, `600ms cubic-bezier(0.16,1,0.3,1)`. `document.body.style.cursor = 'none'`
- [x] **7.3** `isIdle === false`: all spring back `400ms` same easing. Cursor restores on first `mousemove`.
- [x] **7.4** Idle exemptions: `isPlaying === false` → timer never starts, never idles. Pausing while idle → immediately exits idle.
- [x] **7.5** All hooks (`useRef`, `useCallback`, `useState`) in hook, no state leaks. Cleanup on unmount.

### 🧪 Checkpoint 7
- **Playing, no mouse 3s:** Controls + TrackInfo + ThemePicker + ring fade out, cursor disappears
- **Move mouse:** Everything fades back in
- **Paused:** Idle never triggers
- **Empty:** Idle never triggers

---

## PHASE 8 — Progress Ring Polish ✅ COMPLETE
> Scrub-to-seek, Aurora ring, Vapor pulse.

- [x] **8.1** Ring color `var(--ring-fill)` ✔ already wired. Drop-shadow `var(--ring-glow)` ✔ already wired.
- [x] **8.2** Ring glow: `filter: drop-shadow(0 0 4px var(--ring-glow))` on arc — confirmed present. Grows to `8px` while scrubbing.
- [x] **8.3** **Aurora exclusive** — decorative full-circle outer ring (`decorRadius = center-2`), `stroke: var(--ui-accent)`, `motion.circle` with `opacity [0.2, 0.5, 0.2]` 3s loop.
- [x] **8.4** **Vapor exclusive** — arc has `animation: glow-pulse 3s ease-in-out infinite alternate` (keyframe already in animations.css).
- [x] **8.5** Scrub interaction: `onPointerDown` → `setPointerCapture` + `isScrubbing: true`, `onPointerMove` → live angle→position math, `onPointerUp` → `releasePointerCapture` + `onSeek(pos)`. Works outside ring bounds.
- [x] **8.6** Scrub handle dot — appears at arc head, `r:4` → `r:6` on grab. Scrub timestamp tooltip follows angle with `M:SS` label on black pill background.
- [x] **Rules of Hooks fix** — All hooks hoisted above `if (duration <= 0) return null` early return.

### 🧪 Checkpoint 8
- **Playing:** Arc advances in theme color + glow
- **Aurora:** Full outer decorative ring breathing
- **Vapor:** Arc pulses in sync with glow-pulse
- **Click-drag ring:** Position scrubs live, timestamp tooltip follows
- **Release:** Playback jumps to new position
- **Paused:** Ring visible but not scrubbing (canSeek gates this)

---

## PHASE 9 — Settings Modal
> Glass modal over player. Theme switching + display toggles.

- [x] **9.1** `Settings/index.tsx` — full-viewport overlay, `backdrop-filter: blur(8px)`. Center glass panel: `640px`, `backdrop-filter: blur(24px)`, `--ui-bg`, `border-radius: var(--radius-lg)`.

- [x] **9.2** Open/close — gear icon top-right. Open: `scale(0.95)→scale(1)` + fade 300ms. Close: reverse. `AnimatePresence`. Escape key closes.

- [x] **9.3** Left sidebar — `THEMES / VINYL / DISPLAY / ABOUT`. `var(--font-mono)`, 12px uppercase. Hover: `translateX(4px)` spring.

- [x] **9.4** **THEMES section** — 5 theme cards 2-col grid. Mini disc preview (40px circle in theme bg color). Active: `box-shadow: 0 0 0 2px var(--ui-accent)`.

- [x] **9.5** **VINYL section** — toggles: Vinyl Wobble, Album Art Ambient, Film Grain. CSS brushed-metal thumb, spring snap.

- [x] **9.6** **DISPLAY section** — toggles: Lean-Back Mode, Cursor Hide. Slider: Idle Timeout 1–5s.

- [x] **9.7** Particle canvas behind modal — 25 floating 2px dots, white 20% opacity, drift upward, wrap. Only when settings open.

- [x] **9.8** Settings open while playing — music continues, disc visible blurred behind modal.

### 🧪 Checkpoint 9
- Gear icon → modal slides in. Escape → closes. Theme card → theme switches. Toggles work. Paper/Glass: light modal bg.

---

## PHASE 10 — Empty State Polish

- [x] **10.1** Empty disc: VinylDeck wordmark in `var(--font-display)` as center label. No rotation, no wobble.
- [x] **10.2** Empty ambient: theme default orbs float, grain runs, scene alive but neutral.
- [x] **10.3** Empty TrackInfo: `"— / —"` placeholder. ProgressRing hidden (`duration === 0` already returns null).
- [x] **10.4** Empty controls: visible, disabled, `opacity: 0.35`, `pointer-events: none`. Arm at home 25°.
- [x] **10.5** Mock source auto-loads first track on start — confirm no empty-state flash.

### 🧪 Checkpoint 10
- Cold start: first track loads immediately (no empty flash)
- Forced empty: correct disc logo, dimmed controls, no ring, floating orbs

---

## PHASE 11 — Performance & GPU Hardening ✅ COMPLETE
> Build-verified and manually approved. User reported performant behavior with no visual loss.

- [x] **11.1** Audit all keyframes — only `transform` + `opacity` where practical (no `top`/`left`/`width`/`height` that force layout). Approved exception: Aurora/Vapor background-position identity layers.
- [x] **11.2** `will-change: transform` on active animated elements. Removed from static elements.
- [x] **11.3** `useVinylRotation` — RAF loop, no React state for rotation value ✅ (already correct)
- [x] **11.4** `handleMouseMove` specular — direct `element.style.setProperty` DOM mutation, no `setState` ✅ (already correct)
- [x] **11.5** Settings particle canvas — RAF with proper cleanup on unmount
- [x] **11.6** Vapor grid — pure CSS `@keyframes`, no JS

### 🧪 Checkpoint 11 ✅
- DevTools Performance: no frames <55fps during playback, no layout/paint on disc rotation

---

## PHASE 12 — Tauri Shell & Window Management
> Stage 3. Requires Phases 0–11 complete.

- [ ] **12.1** Frameless window, transparent bg, `resizable: true`, min `400×500`, default `600×700`
- [ ] **12.2** Custom titlebar — traffic light dots, `height: 32px` drag region, theme-styled
- [ ] **12.3** Window modes: Normal, Compact, Mini Widget (circular window)
- [ ] **12.4** System tray icon + right-click menu (Play/Pause, Next, Prev, Open, Quit)
- [ ] **12.5** Global keyboard shortcuts: Space, ←/→, ↑/↓, Cmd/Ctrl+,
- [ ] **12.6** Settings persistence via `@tauri-apps/plugin-store` (theme, idle, wobble, grain)

### 🧪 Checkpoint 12
- Frameless, draggable, tray icon functional, Space play/pause, theme persists on reopen

---

## PHASE 13 — SMTC / Real Media Source
> Stage 4. Rust backend. Requires Phase 12.

- [ ] **13.1** Rust SMTC polling loop in `src-tauri/src/smtc.rs`
- [ ] **13.2** Tauri commands: `get_now_playing`, `media_play`, `media_pause`, `media_next`, `media_previous`
- [ ] **13.3** `SMTCSource` implementing `PlaybackSource` interface
- [ ] **13.4** Wire SMTC source in `App.tsx` — Tauri env → SMTC, dev → MockSource
- [ ] **13.5** Album art from SMTC thumbnail → FAC color extraction
- [ ] **13.6** Fallback: no SMTC media → empty state

### 🧪 Checkpoint 13
- Spotify playing → VinylDeck shows correct info, album art ambient correct, Next/Prev work

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Foundation | ✅ Complete | Tokens, fonts, radius, color-scheme all wired |
| 1 — Ambient Layer | ✅ Complete | Float drift, center orb, grain, light-mode vignette |
| 2 — Vinyl Physics | ✅ Complete | Wobble, counter-rotation, specular tuned |
| 3 — Tonearm | ✅ Complete | LED themed, needle bump, skip lift/re-drop |
| 4 — Controls | ✅ Complete | Glassmorphism pill, icon morph, all states |
| 5 — Track Info | ✅ Complete | Theme fonts, slide transitions, empty state |
| 6 — Theme Layers | ✅ Complete | Aurora breath, Vapor grid, Paper glow, Glass blobs, label themes |
| 7 — Idle Mode | ✅ Complete | useIdleMode hook, 3s fade, cursor hide, pause-exemption |
| 8 — Progress Ring | ✅ Complete | Scrub-to-seek, Aurora ring, Vapor pulse, tooltip |
| 9 — Settings Modal | ✅ Complete | Settings shell, tabs, theme cards, toggles, display controls, particles |
| 10 — Empty State | ✅ Complete | Empty-state QA toggle and full polish approved |
| 11 — Performance | ✅ Complete | Keyframe/will-change cleanup build-verified and manually approved |
| 12 — Tauri Shell | 🔲 Stage 3 | New session |
| 13 — SMTC | 🔲 Stage 4 | New session |

---

## State Coverage Matrix

| State | Description | Must Test |
|-------|-------------|-----------|
| `empty` | No track loaded | Disc still, arm home 25°, controls dimmed |
| `playing` | Track active | Disc spinning + wobble, arm at 10°, controls active |
| `paused` | Track loaded, stopped | Disc still, arm at 10° (in groove, NOT lifted), play icon |
| `scrubbing` | User dragging progress ring | Live timestamp, preview position, pointer capture |
| `next` | Next track triggered | Arm lifts→drops, title slides left, new track loads |
| `previous` | Prev track triggered | Same as next |
| `hover` | Mouse over interactive | Scale/brightness feedback, correct cursor |
| `click` | Button pressed | scale(0.88), springs back, immediate visual response |
| `theme-switch` | Theme changed | All colors/fonts update, no flash of wrong colors |
| `idle` | 3s no mouse while playing | Controls fade, cursor hidden, disc + orbs remain |
