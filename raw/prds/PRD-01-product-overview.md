# PRD-01 — VinylDeck: Product Overview & Architecture

**Version:** 1.0  
**Date:** 2026-06-08  
**Status:** Final Lock

---

## 1. What This Is

**VinylDeck** is a standalone desktop application that wraps the system's currently-playing audio in a cinematic, vinyl-record visual experience. It does not stream music, store music, or authenticate with any music service. It reads whatever is playing through the OS media API and renders it as an immersive, animated turntable.

**Tagline:** *A cinematic vinyl experience for everything playing on your computer.*

### What It Is Not

- Not a streaming app
- Not a Spotify plugin or Spicetify extension
- Not a music library manager
- Not an equalizer or audio processor
- Not a Rainmeter skin
- Not an Electron app

---

## 2. Final Decision Lock

| Decision | Choice | Reason |
|---|---|---|
| App type | Standalone desktop | Universal, not locked to one music service |
| Media source | OS Media APIs (SMTC / NowPlaying / MPRIS) | Works with Spotify, YouTube Music, VLC, anything — no auth |
| Desktop shell | Tauri v2 | ~6MB binary, Rust backend, native feel, NOT Electron |
| Primary platform | Windows (first) | User's platform; largest desktop market gap vs MD Vinyl |
| Secondary platform | Android + iOS (Phase 2) | Tauri v2 natively targets both — same codebase |
| Frontend | React + TypeScript | Component model maps well to the vinyl architecture |
| Animation | Motion (motion/react) v12 | Spring physics, Web Animations API, hardware-accelerated |
| State | Zustand | Single shared store for playback state + theme + settings |
| Theming | CSS Custom Properties | Runtime theme switching without re-renders |
| Color extraction | @vibrant/core | Album art → accent colors for ambient layer |

---

## 3. The Product Vision in One Sentence

> Any music app plays music → Windows reads it via SMTC → VinylDeck turns it into a spinning vinyl with cinematic lighting, ambient colors from the album art, and a needle that physically lowers and lifts.

---

## 4. Market Position

MD Vinyl is the only real competitor. It is mobile-first (iOS-first), has a weak Android version, and has essentially no desktop story. The Windows desktop with OLED monitors, ultrawide screens, and second screens is wide open. That is where VinylDeck lives first.

---

## 5. Tech Stack (Exact Versions at Time of Writing)

```
Tauri:          v2.10.1 (stable, March 2026)
Rust:           1.79+
Node.js:        20+ LTS
React:          19
TypeScript:     5.4+
Motion:         12.x  (import from "motion/react" — NOT "framer-motion")
Zustand:        5.x
Vite:           6.x  (Tauri's default bundler)
@vibrant/core:  2.x  (color extraction from album art)
```

**Do not use `framer-motion`.** The package was renamed to `motion` in 2025. Import as:
```typescript
import { motion, useSpring, useMotionValue, AnimatePresence } from "motion/react"
```

---

## 6. Architecture

### 6.1 The Core Abstraction

Everything in VinylDeck communicates through one interface. The Visual Engine never knows or cares where the music comes from.

```typescript
// src/lib/playback/types.ts

export interface PlaybackState {
  // Track metadata
  track: string;
  artist: string;
  album: string;
  artworkDataUrl: string | null;   // base64 data URI or null
  duration: number;                // seconds, 0 if unknown
  position: number;                // seconds, client-side extrapolated
  isPlaying: boolean;

  // Source info
  sourceName: string;              // "Spotify", "Chrome", "VLC", etc.
  sourceId: string;                // OS session ID

  // Capabilities (not all sources support everything)
  canSeek: boolean;
  canSkip: boolean;
  canControl: boolean;
}

export interface PlaybackSource {
  // Returns current state snapshot
  getState(): PlaybackState;

  // Command interface — fire and forget, gracefully ignored if not supported
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  next(): void;
  previous(): void;
  seekTo(seconds: number): void;

  // Event subscriptions
  onStateChange(callback: (state: PlaybackState) => void): () => void; // returns unsubscribe fn

  // Lifecycle
  start(): Promise<void>;
  stop(): void;
}
```

### 6.2 Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                  VISUAL ENGINE (React)               │
│  VinylRecord / NeedleArm / AmbientLayer / Themes    │
│  Knows nothing about where music comes from          │
└───────────────────────┬─────────────────────────────┘
                        │  PlaybackState (interface)
┌───────────────────────▼─────────────────────────────┐
│               ADAPTER LAYER (Zustand store)          │
│  Bridges any PlaybackSource → PlaybackState shape    │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼
┌───────────────┐ ┌──────────────┐ ┌────────────────┐
│  Windows SMTC │ │  MockSource  │ │ Future Sources │
│  (Rust/WinRT) │ │  (dev/test)  │ │ (Android, iOS) │
└───────────────┘ └──────────────┘ └────────────────┘
        │
┌───────▼───────────────────────────────────────────┐
│              RUST / TAURI BACKEND                  │
│  Polls SMTC via windows crate (WinRT bindings)     │
│  Emits Tauri events to frontend                    │
└───────────────────────────────────────────────────┘
```

### 6.3 Project Structure

```
vinyldeck/
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── media/
│   │   │   ├── mod.rs
│   │   │   ├── smtc.rs             # Windows SMTC reader
│   │   │   ├── events.rs           # Event types emitted to frontend
│   │   │   └── artwork.rs          # Artwork → base64 conversion
│   │   ├── window/
│   │   │   ├── mod.rs
│   │   │   └── modes.rs            # Always-on-top, mini, fullscreen
│   │   └── tray.rs                 # System tray
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
│
└── src/                            # React frontend
    ├── main.tsx
    ├── App.tsx
    ├── lib/
    │   ├── playback/
    │   │   ├── types.ts             # PlaybackState, PlaybackSource interfaces
    │   │   ├── tauriSource.ts       # Tauri event → PlaybackSource adapter
    │   │   ├── mockSource.ts        # For development without real media
    │   │   └── store.ts             # Zustand store (single source of truth)
    │   ├── color/
    │   │   └── extractor.ts         # @vibrant/core wrapper
    │   └── themes/
    │       ├── types.ts
    │       ├── definitions.ts       # All 5 themes defined
    │       └── applier.ts           # Sets CSS custom properties
    │
    ├── components/
    │   ├── VinylRecord/
    │   │   ├── index.tsx
    │   │   ├── Grooves.tsx
    │   │   ├── Label.tsx
    │   │   ├── Reflections.tsx
    │   │   └── VinylRecord.css
    │   ├── NeedleArm/
    │   │   ├── index.tsx
    │   │   └── NeedleArm.css
    │   ├── AmbientLayer/
    │   │   ├── index.tsx
    │   │   └── AmbientLayer.css
    │   ├── ProgressRing/
    │   │   ├── index.tsx
    │   │   └── ProgressRing.css
    │   ├── TrackInfo/
    │   │   └── index.tsx
    │   ├── Controls/
    │   │   └── index.tsx
    │   ├── ThemePicker/
    │   │   └── index.tsx
    │   └── MiniPlayer/
    │       ├── index.tsx
    │       └── MiniPlayer.css
    │
    ├── views/
    │   ├── MainView.tsx             # Primary app window (16:9 fullscreen-capable)
    │   ├── FullscreenView.tsx       # Cinematic fullscreen mode
    │   └── MiniView.tsx             # Compact always-on-top popup
    │
    ├── styles/
    │   ├── global.css
    │   ├── themes.css               # CSS custom property definitions
    │   └── animations.css           # Reusable keyframe animations
    │
    └── hooks/
        ├── usePlayback.ts           # Access PlaybackState from Zustand
        ├── useVinylRotation.ts      # requestAnimationFrame rotation loop
        └── useColorExtraction.ts    # Extract palette from current artwork
```

---

## 7. SMTC: What You Actually Get From Windows

This is the honest breakdown of what SMTC provides and what it doesn't. Do not build features that assume more than what's available.

| Field | Available | Notes |
|---|---|---|
| Track title | ✅ Always | |
| Artist | ✅ Usually | Some apps omit |
| Album | ✅ Usually | Some apps omit |
| Album artwork | ✅ Usually | As stream, convert to base64. Spotify ✅, Chrome ✅, YouTube Music ✅, VLC varies |
| Duration | ✅ Usually | Some players report 0 |
| Current position | ⚠️ Sometimes | Many apps report position; some don't. Must extrapolate client-side when missing |
| Is playing | ✅ Always | |
| Play/pause control | ✅ Usually | Depends on app. Send command, ignore if fails |
| Skip next/prev | ✅ Usually | Same caveat |
| Seek to position | ⚠️ Sometimes | Only apps that expose seek via SMTC (Spotify ✅, most browsers ✅) |
| Audio waveform / FFT data | ❌ Never | SMTC does NOT provide audio data. Audio reactivity requires WASAPI loopback (Phase 3+) |

**Key implication:** The progress ring and vinyl rotation must gracefully degrade when duration or position is unavailable. Show the ring only when duration > 0. Extrapolate position using `Date.now()` from last known position + isPlaying state.

---

## 8. Phase Roadmap

### Phase 1 — Windows MVP (Build This First)
**Goal:** Make something beautiful that runs on Windows.

- Tauri v2 app scaffolded and running
- SMTC integration (Rust backend polling, events to frontend)
- Visual Engine: VinylRecord, NeedleArm, AmbientLayer
- 5 themes: Noir, Glass, Aurora, Vapor, Paper
- Fullscreen mode
- Mini player / always-on-top compact mode
- System tray
- Settings persistence (theme, last window mode)
- MockSource for development

**Definition of done:** Open Spotify, play a song, VinylDeck shows the album art spinning on vinyl with the correct ambient glow, and the needle lowers/lifts on play/pause.

### Phase 2 — Mobile (Android + iOS, Tauri v2)
**Goal:** Same visual engine, portrait layout, mobile media APIs.

- Adapted React layout for portrait orientation
- Android MediaSession via Tauri Android plugin
- iOS MPNowPlayingInfoCenter via Tauri iOS plugin
- No system tray, no always-on-top (mobile doesn't have these)
- Lock screen widget (if possible with Tauri)

### Phase 3 — Audio Reactivity (WASAPI Loopback)
**Goal:** Vinyl that physically pulses to the music.

- WASAPI loopback capture in Rust (separate audio thread)
- FFT → frequency band data → Tauri events
- Vinyl glow reacts to bass frequencies
- Groove shimmer reacts to mid frequencies
- This is a distinct, complex feature. Do not mix concerns with SMTC.

### Phase 4 — Advanced Visual
**Goal:** Exceed MD Vinyl on visual quality.

- WebGL vinyl with real-time reflections (Three.js or custom WebGL)
- 3D tonearm with perspective
- Particle systems (subtle, not gamified)
- Transparent window mode (Windows DWM composition)
- Multi-monitor: detect second screen, auto-offer to move there

---

## 9. Non-Goals (Things Explicitly Excluded)

These will never be in VinylDeck. Not because they're bad ideas, but because they compromise the product's identity.

- **No streaming.** VinylDeck never plays music itself.
- **No library management.** No playlists, no song browsing.
- **No lyrics display.** Clutters the visual. Other apps do this better.
- **No social features.** No sharing, no activity feeds.
- **No Electron.** The performance penalty is incompatible with this product's identity.
- **No Spotify-only mode.** The OS media approach is the point.
- **No subscription pricing.** One-time purchase or free with cosmetic upgrades. This is a *thing*, not a service.

---

## 10. Honest Risks

| Risk | Impact | Mitigation |
|---|---|---|
| SMTC artwork not available for some apps | Moderate | Fallback to default vinyl label (solid color). Never crash. |
| SMTC position not available | Low | Extrapolate client-side; hide progress ring if duration = 0 |
| tauri-plugin-media is a community plugin and may lag | Moderate | Write your own SMTC Rust commands using the `windows` crate as a fallback. The WinRT bindings are documented and stable. |
| WebView2 blur performance on low-end hardware | Moderate | Provide "Reduce Motion / Reduce Blur" toggle in settings. Use `prefers-reduced-motion` media query. |
| Spotify changing SMTC behavior | Low | SMTC is controlled by Windows, not Spotify. Spotify would break Windows media keys system-wide if they removed it. |
| Motion v12 API changes | Low | Lock exact version in package.json. |

---

## 11. Tauri SMTC Implementation Note

If `tauri-plugin-media` does not work or its "read from other apps" API is incomplete, implement SMTC reading directly in Rust using the `windows` crate:

```toml
# Cargo.toml
[dependencies.windows]
version = "0.56"
features = [
  "Media_Control",
  "Storage_Streams",
  "Foundation",
]
```

```rust
// src-tauri/src/media/smtc.rs
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

pub async fn get_current_session() -> windows::core::Result<Option<MediaSnapshot>> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let session = manager.GetCurrentSession()?;
    // ... get MediaProperties, PlaybackInfo, TimelineProperties
}
```

The `GlobalSystemMediaTransportControlsSessionManager` is the correct WinRT class for reading media from OTHER applications running on the system. This is different from `SystemMediaTransportControls` which is for registering YOUR app as a media source.

This distinction is critical. Read from `GlobalSystemMediaTransportControlsSessionManager`, not `SystemMediaTransportControls`.
