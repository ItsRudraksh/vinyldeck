# VinylDeck: Current State

**Current Phase:** Phase 1 (Windows Desktop MVP)
**Current Stage:** Windows backend — approved plan ready for execution

## Active Work
Detailed Windows backend plan approved. Fresh session should begin at `backend_master_task_list.md` task B0.1.

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
None.

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
- Browser verification is user-controlled for now; do not use Browser unless user explicitly asks.

## Incident Note
- During Stage 1 scaffold, `npx create-tauri-app . --force` was used. The `--force` flag wiped `raw/`, `.agents/memory/`, `stitch-ui-designs/`, and all other pre-existing project files. User restored from backup. **Do NOT use `--force` or any destructive flag in this directory ever again.**

## Environment (Verified)
- Node.js: v24.12.0
- npm: v11.6.2
- Rust/cargo: 1.96.0
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
