# VinylDeck: Architectural Decisions Record

## DECISION: Ambient Color Extraction — LOCKED (2026-06-08, FINAL)

**Approach: fast-average-color `simple` algorithm + HSL boost**

- Library: `fast-average-color` ^9.5.2
- Algorithm: `simple` — straight weighted average of all pixels
- Input: HTMLImageElement (loaded with crossOrigin="anonymous")
- Ignored: near-white pixels (threshold 25), near-black pixels (threshold 15)
- Post-process: HSL saturation boosted to min 0.55 (max 0.90), lightness clamped 0.25–0.50
- Near-achromatic result (saturation < 0.05) → `resetAmbientColors()` → theme CSS tokens hold
- Single color → BOTH orbs → uniform cinematic wash (no dual-gradient split)
- Both orbs use `mix-blend-mode: screen` — color blooms luminously on OLED black

**Algorithm history (tested, rejected):**
- `@vibrant/core` — vibrance-first, picks UI-accent color not ambient mood
- `node-vibrant` — Node.js-only; browser adapter broken in Vite/Tauri
- `colorthief` MMCQ — area-dominant; picks dark shadow zones in real photos, not mood
- FAC `dominant` — worst result; coarse bucketing picks arbitrary noise clusters
- FAC `sqrt` — grey-cancellation on complex photos (BIA: blue + gold averaged to grey)
- FAC `simple` ✅ — best across all art types; keeps overall mood hue

**Why single color over dual:**
- Dual orbs with different colors created a visible left-dark/right-bright split that looked like a rendering artifact
- Single uniform wash matches the mock track behavior (Neon Requiem purple reference)

---

## Core Technology Decisions

| Date       | Area                 | Decision                           | Reason                                                                                                                                 |
| ---------- | -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-08 | App Type             | **Standalone Desktop Application** | Universal support for any music player via OS media APIs.                                                                              |
| 2026-06-08 | Media Source         | **OS Media APIs (SMTC)**           | Works with Spotify, YouTube Music, VLC without authentication.                                                                         |
| 2026-06-08 | Desktop Shell        | **Tauri v2**                       | ~6 MB binary, Rust backend, native platform integration, far lighter than Electron.                                                    |
| 2026-06-08 | Frontend             | **React + TypeScript**             | Component architecture maps naturally to VinylDeck visual hierarchy.                                                                   |
| 2026-06-08 | Animation Engine     | **motion/react v12**               | Spring physics + Web Animations API provide physical, tactile motion.                                                                  |
| 2026-06-08 | Theming System       | **CSS Custom Properties**          | Instant runtime theme switching without React re-renders.                                                                              |
| 2026-06-08 | Media Polling        | **500ms Rust Polling Loop**        | SMTC WinRT COM STA events are unreliable; polling is simple and deterministic.                                                         |
| 2026-06-08 | Playback Abstraction | **`PlaybackSource` Interface**     | Visual Engine remains decoupled from Tauri commands; consumes only `PlaybackState`.                                                    |
| 2026-06-08 | Design System        | **Five Cinematic Themes**          | Noir, Glass, Aurora, Vapor, Paper — implemented as CSS custom property blocks.                                                         |
| 2026-06-08 | Color Extraction     | **fast-average-color simple**      | Best generalized ambient mood extraction across all album art types. See above.                                                        |
| 2026-06-08 | Ambient Rendering    | **mix-blend-mode: screen**         | Screen blend on OLED black makes any color bloom luminously. Dark orb without it = dark smudge. |
| 2026-06-10 | Perf Exceptions      | **Aurora/Vapor background-position exceptions** | Phase 11 keeps animation paths transform/opacity-first, but Aurora gradient shift and Vapor grid travel intentionally animate `background-position` on isolated background layers because they define those theme identities. |
| 2026-06-11 | Settings Authority Caveat | **Cross-WebView settings authority unresolved** | Zustand-owned settings plus Tauri Store are implemented, but main/mini are separate WebViews with independent stores. Mini theme persistence is parked as BUG-002 until a stronger architecture is chosen. |

---

## Architectural Principles

1. The Visual Engine must remain independent of platform-specific APIs.
2. All media information must flow through the `PlaybackSource` abstraction layer.
3. Runtime theme switching must never require component remounting.
4. All animations must use spring-based motion rather than linear easing.
5. The application must remain lightweight, native-feeling, and hardware-efficient.
6. New media providers should be added by implementing `PlaybackSource` without modifying the Visual Engine.

---

## ⚠️ Critical Safety Lock

**NEVER use `--force`, `--yes` combined with destructive scaffold tools, or any flag that overwrites/clears an existing non-empty directory in `c:\Coding\vinyldeck\`.** On 2026-06-08, `npx create-tauri-app . --force` destroyed all pre-existing files. User restored from backup. Always scaffold into a clean temp directory and copy only what is needed.

**Last Updated:** 2026-06-11
