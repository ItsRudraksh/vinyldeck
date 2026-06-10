# VinylDeck: Project Context

## What This Is

**VinylDeck** is a standalone desktop application that wraps the system's currently-playing audio in a cinematic, vinyl-record visual experience. It reads whatever is playing through the OS media API and renders it as an immersive, animated turntable.
**Tagline:** _A cinematic vinyl experience for everything playing on your computer._

## Architecture

- **Visual Engine (React):** Responsible for the cinematic UI. Knows nothing about the media source. Communicates exclusively via a `PlaybackState` interface.
- **Adapter Layer (Zustand):** Frontend cache for React components. In Tauri it must not be the authority for multi-window dynamic state.
- **Backend (Tauri/Rust):** Owns cross-window dynamic state and commands. Playback authority moves here before tray/shortcuts/SMTC so any number of windows can subscribe to the same source of truth.

## Multi-Window Authority Direction

- Browser development can keep `MockSource`.
- Tauri main and mini must read playback from the Rust backend via events/commands, not from separate frontend sources.
- Avoid window-to-window bridges for core state. Windows are views/controllers; backend is authority.
- Settings are currently main-write-only after BUG-002, but if the backend-owned playback pattern works cleanly, settings should migrate backend-owned too.

## Technology Stack

- **Desktop Shell:** Tauri v2 (Rust backend)
- **Frontend:** React 19 + TypeScript
- **Animation:** `motion/react` v12 (formerly framer-motion)
- **State Management:** Zustand v5
- **Color Extraction:** `fast-average-color` v9 — simple algorithm + HSL boost
- **Theming:** CSS Custom Properties (5 cinematic themes: Noir, Glass, Aurora, Vapor, Paper)
- **Ambient Bloom:** Two CSS orbs with `mix-blend-mode: screen`, single extracted color, uniform wash
