# VinylDeck: Roadmap & Build Sequence

This tracks the overarching phases and the strict build sequence for Phase 1.

## Phases

- **Phase 1:** Windows Desktop MVP (Tauri v2 + SMTC)
- **Phase 2:** Mobile Port (Android + iOS via Tauri v2)
- **Phase 3:** Audio Reactivity (WASAPI loopback for frequency-based pulsing)
- **Phase 4:** Advanced Visuals (WebGL, 3D tonearm, particles)

---

## Phase 1 Build Sequence

_Do not skip ahead. Do not build the media layer before the visual engine looks good._

### [x] Stage 0 & 1 — Project Scaffold ✅ COMPLETE

- [x] Initialize Tauri v2 + React + TS project. (`create-tauri-app`, react-ts template, npm)
- [x] Install dependencies (`motion` v12, `zustand` v5, `fast-average-color` v9, `@tauri-apps/plugin-store` v2, `@types/node`).
- [x] Cargo.toml updated with all PRD-03 §3.1 deps (tauri tray-icon/image-png, tokio, base64, image, windows 0.56 SMTC crate).
- [x] `cargo build` passes. `Finished dev profile in 37.14s`. No errors.
- **Final deps:** motion ^12.40.0, zustand ^5.0.14, fast-average-color ^9.5.2, react ^19.1.0, cargo-tauri v2.11.2

### [x] Stage 2 — Visual Engine with MockSource ✅ COMPLETE

- **Focus:** Build the complete UI with mock data.
- Global CSS & Themes (5 cinematic themes, CSS custom properties).
- VinylRecord, NeedleArm, AmbientLayer, ProgressRing, TrackInfo, Controls.
- `MockSource` integration and Color Extraction (fast-average-color simple + HSL boost).
- Ambient bloom: mix-blend-mode: screen, single-color uniform wash.
- Settings Modal, Empty State, and Performance/GPU hardening completed and user-approved.
- _Exit criteria:_ ✅ App looks beautiful, physical, animated, and performant in the browser without real media.

### [ ] Stage 3 — Tauri Shell & Window Management

- Parked until user explicitly says to move beyond visual work.
- Settings persistence.
- Window modes (Main, Fullscreen, Mini always-on-top).
- System tray and keyboard shortcuts.

### [ ] Stage 4 — SMTC Media Integration (Windows)

- Rust SMTC reader via `windows` crate.
- 500ms background polling loop.
- Tauri commands and frontend `TauriSource` adapter.
- _Exit criteria:_ App reacts to real Spotify/System music playback.

### [ ] Stage 5 — Polish Pass

- Fine-tune spring stiffness, damping, inertia, glow intensities, and typography.

### [ ] Stage 6 — Build and Ship

- Compile `.msi` and `.exe`.
