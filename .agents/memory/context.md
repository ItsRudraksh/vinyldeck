# VinylDeck: Project Context

## What This Is

**VinylDeck** is a standalone desktop application that wraps the system's currently-playing audio in a cinematic, vinyl-record visual experience. It reads whatever is playing through the OS media API and renders it as an immersive, animated turntable.
**Tagline:** _A cinematic vinyl experience for everything playing on your computer._

## Architecture

- **Visual Engine (React):** Responsible for the cinematic UI. Knows nothing about the media source. Communicates exclusively via a `PlaybackState` interface.
- **Adapter Layer (Zustand):** Bridges `PlaybackSource` to the React components. Single source of truth.
- **Backend (Tauri/Rust):** Polls the OS media APIs (Windows SMTC initially) and emits events to the frontend.

## Technology Stack

- **Desktop Shell:** Tauri v2 (Rust backend)
- **Frontend:** React 19 + TypeScript
- **Animation:** `motion/react` v12 (formerly framer-motion)
- **State Management:** Zustand v5
- **Color Extraction:** `fast-average-color` v9 — simple algorithm + HSL boost
- **Theming:** CSS Custom Properties (5 cinematic themes: Noir, Glass, Aurora, Vapor, Paper)
- **Ambient Bloom:** Two CSS orbs with `mix-blend-mode: screen`, single extracted color, uniform wash
