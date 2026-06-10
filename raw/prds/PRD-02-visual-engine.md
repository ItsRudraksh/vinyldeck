# PRD-02 — VinylDeck: Visual Engine

**Version:** 1.0  
**Date:** 2026-06-08  
**Depends on:** PRD-01

---

## 1. Purpose

This document fully specifies the Visual Engine — the React frontend responsible for all rendering and animation. The Visual Engine only knows about `PlaybackState`. It never calls OS APIs or Tauri commands directly.

The visual engine is the product. Build it first with `MockSource` before wiring any real media.

---

## 2. Design Principles (Non-Negotiable)

1. **GPU-only animations.** Every animation must use only `transform` and `opacity`. No animating `width`, `height`, `top`, `left`, `margin`, `background-color` directly. Color changes happen via CSS custom property transitions, not JS-animated properties.
2. **Spring physics over linear.** Every transition uses spring easing, not `ease-in-out`. The app should feel physical.
3. **Cinematic spacing.** Large margins. Oversized artwork. Empty space is a design element.
4. **Graceful degradation.** If artwork is null, show a styled fallback label. If position is unavailable, hide the progress ring. Never crash, never show an empty broken state.
5. **Theme-first.** Every color value comes from a CSS custom property. Hard-coded hex values in component CSS are never acceptable.
6. **60fps minimum, 120fps target.** Use `will-change: transform` on animated elements. Test on integrated graphics.

---

## 3. CSS Custom Properties — The Theme System

All theming is done by setting custom properties on `:root`. JavaScript never touches individual color values — it only switches the active theme class.

### 3.1 Full Property Specification

```css
/* src/styles/themes.css */

:root {
  /* === Vinyl === */
  --vinyl-color: #111111;
  --vinyl-groove-inner: rgba(255,255,255,0.04);
  --vinyl-groove-outer: rgba(255,255,255,0.015);
  --vinyl-sheen: rgba(255,255,255,0.08);
  --vinyl-label-bg: #1a1a1a;

  /* === Needle Arm === */
  --needle-color: #c0c0c0;           /* brushed silver */
  --needle-hinge-color: #a0a0a0;
  --needle-shadow: rgba(0,0,0,0.6);

  /* === Ambient Background === */
  --ambient-primary: #111111;        /* extracted from artwork primary color */
  --ambient-secondary: #1a1a1a;      /* extracted from artwork secondary color */
  --ambient-blur: 120px;
  --ambient-opacity: 0.6;

  /* === UI / Controls === */
  --ui-bg: rgba(255,255,255,0.05);   /* glassmorphism card */
  --ui-border: rgba(255,255,255,0.08);
  --ui-text-primary: rgba(255,255,255,0.92);
  --ui-text-secondary: rgba(255,255,255,0.45);
  --ui-accent: #ffffff;              /* overridden per theme */
  --ui-control-hover: rgba(255,255,255,0.12);

  /* === Progress Ring === */
  --ring-track: rgba(255,255,255,0.1);
  --ring-fill: var(--ui-accent);
  --ring-glow: rgba(255,255,255,0.3);

  /* === Glow === */
  --glow-color: rgba(255,255,255,0.2);
  --glow-radius: 80px;
  --glow-opacity: 0.5;

  /* === Transitions === */
  --theme-transition: 600ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

### 3.2 The 5 Themes

Each theme overrides the root custom properties. Apply by setting `data-theme="noir"` on `<html>`.

```css
/* ─── NOIR ──────────────────────────────────────────── */
[data-theme="noir"] {
  --vinyl-color: #0a0a0a;
  --vinyl-groove-inner: rgba(255,255,255,0.05);
  --vinyl-sheen: rgba(255,255,255,0.07);
  --vinyl-label-bg: #141414;
  --needle-color: #888888;
  --ui-bg: rgba(20,20,20,0.85);
  --ui-border: rgba(255,255,255,0.06);
  --ui-text-primary: rgba(255,255,255,0.88);
  --ui-text-secondary: rgba(255,255,255,0.35);
  --ui-accent: #e8e8e8;
  --glow-color: rgba(200,200,200,0.15);
  --ambient-opacity: 0.4;            /* muted, more cinematic */
}

/* ─── GLASS ──────────────────────────────────────────── */
[data-theme="glass"] {
  --vinyl-color: #2a2a3a;
  --vinyl-groove-inner: rgba(255,255,255,0.08);
  --vinyl-sheen: rgba(255,255,255,0.15);
  --vinyl-label-bg: rgba(255,255,255,0.12);
  --needle-color: #d0d8e0;
  --ui-bg: rgba(255,255,255,0.1);
  --ui-border: rgba(255,255,255,0.2);
  --ui-text-primary: rgba(255,255,255,0.95);
  --ui-text-secondary: rgba(255,255,255,0.6);
  --ui-accent: #a0c8ff;
  --glow-color: rgba(160,200,255,0.25);
  --ambient-opacity: 0.7;
}

/* ─── AURORA ──────────────────────────────────────────── */
[data-theme="aurora"] {
  --vinyl-color: #050d1a;
  --vinyl-groove-inner: rgba(0,200,180,0.06);
  --vinyl-sheen: rgba(0,220,200,0.08);
  --vinyl-label-bg: #080f1f;
  --needle-color: #7ae8d4;
  --ui-bg: rgba(0,30,40,0.8);
  --ui-border: rgba(0,200,180,0.15);
  --ui-text-primary: rgba(200,255,250,0.92);
  --ui-text-secondary: rgba(100,200,190,0.55);
  --ui-accent: #00d4be;
  --glow-color: rgba(0,212,190,0.3);
  --ambient-opacity: 0.65;
}

/* ─── VAPOR ──────────────────────────────────────────── */
[data-theme="vapor"] {
  --vinyl-color: #0d0010;
  --vinyl-groove-inner: rgba(200,0,255,0.06);
  --vinyl-sheen: rgba(255,100,200,0.08);
  --vinyl-label-bg: #130018;
  --needle-color: #d080ff;
  --ui-bg: rgba(30,0,40,0.82);
  --ui-border: rgba(200,0,255,0.18);
  --ui-text-primary: rgba(255,200,255,0.9);
  --ui-text-secondary: rgba(180,100,220,0.6);
  --ui-accent: #c855ff;
  --glow-color: rgba(200,85,255,0.35);
  --ambient-opacity: 0.7;
}

/* ─── PAPER ──────────────────────────────────────────── */
[data-theme="paper"] {
  --vinyl-color: #1a1408;
  --vinyl-groove-inner: rgba(200,160,80,0.07);
  --vinyl-sheen: rgba(220,180,100,0.09);
  --vinyl-label-bg: #221a08;
  --needle-color: #c8a84a;
  --ui-bg: rgba(30,22,10,0.82);
  --ui-border: rgba(200,160,80,0.15);
  --ui-text-primary: rgba(240,225,195,0.92);
  --ui-text-secondary: rgba(190,160,110,0.6);
  --ui-accent: #d4a840;
  --glow-color: rgba(212,168,64,0.3);
  --ambient-opacity: 0.55;
}
```

### 3.3 Theme Application (TypeScript)

```typescript
// src/lib/themes/applier.ts

export type ThemeId = "noir" | "glass" | "aurora" | "vapor" | "paper";

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute("data-theme", themeId);
}

// Also override ambient colors when artwork changes
export function applyAmbientColors(primary: string, secondary: string): void {
  const root = document.documentElement;
  root.style.setProperty("--ambient-primary", primary);
  root.style.setProperty("--ambient-secondary", secondary);
}
```

---

## 4. Vinyl Record Component

### 4.1 Visual Layer Stack (bottom to top)

```
Layer 0: Glow bloom (absolutely positioned, behind record)
Layer 1: Record disc (base shape + color)
Layer 2: Grooves (repeating-radial-gradient)
Layer 3: Sheen / highlight (rotating gradient overlay)
Layer 4: Center hole cutout
Layer 5: Label circle (album art or fallback)
Layer 6: Reflections (rotating pseudo-element)
Layer 7: Glass overlay (subtle, very low opacity)
```

### 4.2 CSS — Vinyl Record

```css
/* src/components/VinylRecord/VinylRecord.css */

.vinyl-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Size: controlled by parent via CSS var */
  width: var(--vinyl-size, 420px);
  height: var(--vinyl-size, 420px);
}

/* ─── Glow bloom behind disc ─── */
.vinyl-glow {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    var(--glow-color) 0%,
    transparent 70%
  );
  filter: blur(var(--glow-radius, 80px));
  opacity: var(--glow-opacity, 0.5);
  pointer-events: none;
  will-change: opacity;
  transition: opacity 800ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.vinyl-glow.playing {
  opacity: calc(var(--glow-opacity, 0.5) * 1.4);
}

/* ─── Main disc ─── */
.vinyl-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--vinyl-color);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.04),
    0 8px 40px rgba(0,0,0,0.7),
    0 2px 8px rgba(0,0,0,0.5);
  will-change: transform;
  transform: translateZ(0);  /* force GPU layer */
}

/* ─── Groove layers ─── */
.vinyl-grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle at center,
      transparent 0px,
      transparent 3px,
      var(--vinyl-groove-outer) 3px,
      var(--vinyl-groove-outer) 3.5px
    );
  /* Outer band: denser grooves */
}

.vinyl-grooves::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle at center,
      transparent 0px,
      transparent 2px,
      var(--vinyl-groove-inner) 2px,
      var(--vinyl-groove-inner) 2.4px
    );
}

/* ─── Sheen / light reflection ─── */
.vinyl-sheen {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    var(--vinyl-sheen) 12%,
    transparent 25%,
    transparent 50%,
    var(--vinyl-sheen) 62%,
    transparent 75%,
    transparent 100%
  );
  pointer-events: none;
}

/* ─── Center label area ─── */
.vinyl-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 34%;
  height: 34%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  overflow: hidden;
  background: var(--vinyl-label-bg);
}

.vinyl-label img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ─── Center hole ─── */
.vinyl-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3%;
  height: 3%;
  min-width: 8px;
  min-height: 8px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #000;
  z-index: 10;
  box-shadow: inset 0 0 4px rgba(0,0,0,0.9);
}

/* ─── Spin animation (CSS, NOT JS) ─── */
@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.vinyl-disc.spinning {
  animation: vinyl-spin 1.8s linear infinite;
  /* 1.8s = 33.33 RPM: (60/33.33) = 1.8s per rotation. Authentic. */
}

.vinyl-disc.paused {
  /* Do NOT use animation-play-state: paused — it freezes instantly.
     Instead: remove .spinning class and use JS to preserve rotation angle.
     See useVinylRotation.ts for details. */
  animation: none;
}

/* ─── Inertia: slowdown on pause ─── */
/* Handled in JS via useVinylRotation — see Section 5 */

/* ─── Reflection overlay (counter-rotates slightly for realism) ─── */
.vinyl-reflection {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 180deg,
    transparent 0%,
    rgba(255,255,255,0.03) 10%,
    transparent 20%,
    transparent 80%,
    rgba(255,255,255,0.015) 90%,
    transparent 100%
  );
  pointer-events: none;
  will-change: transform;
}
```

### 4.3 Vinyl Rotation Hook — `useVinylRotation`

This hook controls the vinyl spin with inertia on pause. Pure CSS animation cannot do inertia (deceleration from current speed to 0). This hook handles it.

```typescript
// src/hooks/useVinylRotation.ts

import { useEffect, useRef } from "react";
import { useMotionValue } from "motion/react";

interface UseVinylRotationOptions {
  isPlaying: boolean;
  rpm?: number;           // default 33.33
}

interface UseVinylRotationResult {
  rotation: number;       // current angle in degrees
  cssTransform: string;   // "rotate(Ndeg)" ready to apply
}

export function useVinylRotation({ isPlaying, rpm = 33.33 }: UseVinylRotationOptions) {
  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);       // current angle
  const velocityRef = useRef<number>(0);        // current deg/ms
  const lastTimestampRef = useRef<number | null>(null);
  const targetVelocityRef = useRef<number>(0);

  // Target velocity: playing = full speed, paused = 0
  const degreesPerMs = (rpm / 60) * (360 / 1000); // ~0.2 deg/ms at 33.33 RPM

  useEffect(() => {
    targetVelocityRef.current = isPlaying ? degreesPerMs : 0;
  }, [isPlaying, degreesPerMs]);

  useEffect(() => {
    function tick(timestamp: number) {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const delta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      const target = targetVelocityRef.current;
      const current = velocityRef.current;

      // Smooth velocity interpolation
      // Spin-up: fast (0.8 lerp factor per frame ≈ ~150ms to full speed)
      // Spin-down: slow (0.02 lerp factor ≈ inertia over ~800ms)
      const lerpFactor = target > current ? 0.06 : 0.015;
      velocityRef.current = current + (target - current) * lerpFactor;

      // Update angle
      rotationRef.current = (rotationRef.current + velocityRef.current * delta) % 360;

      // Apply to DOM element directly for performance (avoid React re-renders)
      const el = document.getElementById("vinyl-disc");
      if (el) {
        el.style.transform = `rotate(${rotationRef.current}deg)`;
      }

      // Stop RAF when fully stopped to save resources
      if (Math.abs(velocityRef.current) < 0.00001 && !isPlaying) {
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    // Start the loop
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  // The component should apply: style={{ transform: `rotate(${rotation}deg)` }}
  // But we use direct DOM mutation above for performance.
  // Use id="vinyl-disc" on the element.
}
```

**Important note:** The rotation is applied via direct DOM manipulation (`element.style.transform`), not React state, to avoid triggering re-renders on every animation frame. The element must have `id="vinyl-disc"`. This is intentional and correct.

### 4.4 VinylRecord Component — Full Implementation Spec

```typescript
// src/components/VinylRecord/index.tsx

// Props
interface VinylRecordProps {
  isPlaying: boolean;
  artworkDataUrl: string | null;   // base64 data URI
  trackTitle: string;
  size?: number;                    // px, default 420
}

// Render structure:
// <div class="vinyl-wrapper" style="--vinyl-size: {size}px">
//   <div class="vinyl-glow" class={isPlaying ? "playing" : ""} />
//   <div class="vinyl-disc" id="vinyl-disc">   ← rotation applied here
//     <div class="vinyl-grooves" />
//     <div class="vinyl-sheen" />
//     <div class="vinyl-label">
//       {artworkDataUrl
//         ? <img src={artworkDataUrl} alt={trackTitle} />
//         : <FallbackLabel />}
//     </div>
//     <div class="vinyl-hole" />
//     <div class="vinyl-reflection" />
//   </div>
// </div>

// FallbackLabel: when no artwork
// - Show a colored circle using --ui-accent as background
// - Show the first letter of the track title in large typography
// - Example: no artwork for "Bohemian Rhapsody" → shows "B" centered on colored disc
```

---

## 5. Needle Arm Component

### 5.1 Visual Spec

The needle arm (tonearm) sits to the upper-right of the vinyl. It:
- Pivots from a hinge point at the top-right corner of its container
- Rests at ~25° rotation (lifted, off the record) when paused/idle
- Descends to ~10° rotation (on the record) when playing
- Transition is animated with spring physics, ~600ms

### 5.2 CSS

```css
/* src/components/NeedleArm/NeedleArm.css */

.needle-arm-container {
  position: absolute;
  top: 2%;
  right: 8%;
  width: 28%;
  height: 55%;
  pointer-events: none;
  z-index: 20;
}

.needle-arm {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  transform-origin: 90% 5%;     /* pivot near hinge point */
  will-change: transform;
}

/* Arm body: thin brushed metal line */
.needle-arm__body {
  position: absolute;
  top: 5%;
  right: 8%;
  width: 4px;
  height: 88%;
  background: linear-gradient(
    to right,
    var(--needle-hinge-color),
    var(--needle-color),
    var(--needle-hinge-color)
  );
  border-radius: 2px;
  box-shadow: 0 2px 12px var(--needle-shadow);
  transform: rotate(-8deg);     /* slight angle to look like a real tonearm */
  transform-origin: top center;
}

/* Hinge circle */
.needle-arm__hinge {
  position: absolute;
  top: 0;
  right: 4%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #e0e0e0, var(--needle-hinge-color));
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

/* Stylus head */
.needle-arm__head {
  position: absolute;
  bottom: 0;
  right: 6%;
  width: 12px;
  height: 20px;
  background: linear-gradient(to bottom, var(--needle-color), #666);
  border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
```

### 5.3 Animation with Motion

```typescript
// src/components/NeedleArm/index.tsx

import { motion } from "motion/react";

const NEEDLE_ANGLE_LIFTED = 25;   // degrees: resting position off the record
const NEEDLE_ANGLE_DOWN   = 10;   // degrees: playing position on the record

interface NeedleArmProps {
  isPlaying: boolean;
}

export function NeedleArm({ isPlaying }: NeedleArmProps) {
  return (
    <div className="needle-arm-container">
      <motion.div
        className="needle-arm"
        animate={{
          rotate: isPlaying ? NEEDLE_ANGLE_DOWN : NEEDLE_ANGLE_LIFTED,
        }}
        transition={{
          type: "spring",
          stiffness: 60,
          damping: 18,
          mass: 1.2,
          // These spring values produce ~600ms settling time with natural overshoot
        }}
      >
        <div className="needle-arm__hinge" />
        <div className="needle-arm__body" />
        <div className="needle-arm__head" />
      </motion.div>
    </div>
  );
}
```

---

## 6. Ambient Background Layer

The ambient layer is a full-bleed background that dynamically colors itself from the album artwork. It creates the cinematic "glow" atmosphere that changes with every track.

### 6.1 How It Works

1. When `artworkDataUrl` changes, run `@vibrant/core` to extract 2–3 dominant colors.
2. Set `--ambient-primary` and `--ambient-secondary` on `:root`.
3. The background smoothly transitions to the new colors over ~800ms.
4. The layer is blurred heavily (100–130px) so it reads as ambient lighting, not a recognizable image.

### 6.2 CSS

```css
/* src/components/AmbientLayer/AmbientLayer.css */

.ambient-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: #000;     /* base, always black */
}

/* The blurred color orbs — CSS, not canvas */
.ambient-layer__orb-primary {
  position: absolute;
  width: 70%;
  height: 70%;
  top: 10%;
  left: 15%;
  border-radius: 50%;
  background: var(--ambient-primary, #111);
  filter: blur(var(--ambient-blur, 120px));
  opacity: var(--ambient-opacity, 0.6);
  will-change: opacity;
  transition:
    background var(--theme-transition),
    opacity var(--theme-transition);
}

.ambient-layer__orb-secondary {
  position: absolute;
  width: 50%;
  height: 50%;
  bottom: 0;
  right: 5%;
  border-radius: 50%;
  background: var(--ambient-secondary, #1a1a1a);
  filter: blur(100px);
  opacity: calc(var(--ambient-opacity, 0.6) * 0.7);
  will-change: opacity;
  transition:
    background var(--theme-transition),
    opacity var(--theme-transition);
}

/* Vignette: fade to black at edges. Non-negotiable for cinematic look. */
.ambient-layer__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(0,0,0,0.5) 70%,
    rgba(0,0,0,0.85) 100%
  );
}
```

### 6.3 Color Extraction Hook

```typescript
// src/hooks/useColorExtraction.ts

import { Vibrant } from "@vibrant/core";

export async function extractAmbientColors(dataUrl: string): Promise<{
  primary: string;
  secondary: string;
}> {
  try {
    const palette = await Vibrant.from(dataUrl).getPalette();

    const primary =
      palette.DarkVibrant?.hex ??
      palette.Vibrant?.hex ??
      palette.DarkMuted?.hex ??
      "#1a1a1a";

    const secondary =
      palette.DarkMuted?.hex ??
      palette.Muted?.hex ??
      palette.DarkVibrant?.hex ??
      "#111111";

    return { primary, secondary };
  } catch {
    return { primary: "#1a1a1a", secondary: "#111111" };
  }
}
```

**Color selection rationale:** Use `DarkVibrant` and `DarkMuted` — NOT `Vibrant` or `LightVibrant`. Bright colors make the background overwhelming. Dark, saturated variants read as atmospheric lighting, not garish backgrounds.

---

## 7. Progress Ring Component

A circular SVG progress indicator that wraps around the vinyl.

### 7.1 Spec

- Thin ring (stroke-width: 2–3px) sitting just outside the vinyl disc
- Barely visible track (`--ring-track`)
- Filled arc in `--ring-fill` color showing elapsed position
- Subtle glow on the fill using `filter: drop-shadow`
- Only renders when `duration > 0` (graceful degradation)
- Progress advances client-side using `Date.now()` between SMTC sync events

### 7.2 Implementation Spec

```typescript
// src/components/ProgressRing/index.tsx

interface ProgressRingProps {
  duration: number;     // seconds, 0 = unknown → don't render
  position: number;     // seconds, client-extrapolated
  isPlaying: boolean;
  size: number;         // px, should be vinyl size + ~20px padding
}

// If duration === 0: return null (don't render)
// 
// SVG ring math:
// radius = (size / 2) - strokeWidth - 4   (padding from edge)
// circumference = 2 * Math.PI * radius
// progress = position / duration            (0 to 1)
// dashoffset = circumference * (1 - progress)
//
// Render:
// <svg width={size} height={size} style={{ position: "absolute" }}>
//   {/* Track */}
//   <circle cx={size/2} cy={size/2} r={radius}
//     fill="none" stroke="var(--ring-track)" strokeWidth={2} />
//   {/* Fill arc */}
//   <circle cx={size/2} cy={size/2} r={radius}
//     fill="none" stroke="var(--ring-fill)" strokeWidth={2.5}
//     strokeDasharray={circumference}
//     strokeDashoffset={dashoffset}
//     strokeLinecap="round"
//     transform={`rotate(-90, ${size/2}, ${size/2})`}
//     style={{ filter: "drop-shadow(0 0 3px var(--ring-glow))" }}
//   />
// </svg>
//
// Animate dashoffset with Motion:
// <motion.circle animate={{ strokeDashoffset: dashoffset }}
//   transition={{ duration: 0.3, ease: "linear" }} />
```

### 7.3 Client-Side Position Extrapolation

```typescript
// src/lib/playback/store.ts (Zustand store slice)

// When a SMTC update arrives with a known position:
// - Store: lastKnownPosition = event.position
// - Store: lastSyncTime = Date.now()
// - Store: isPlaying = event.isPlaying

// To get current extrapolated position at render time:
function getExtrapolatedPosition(state: PlaybackStoreState): number {
  if (!state.isPlaying) return state.lastKnownPosition;
  const elapsed = (Date.now() - state.lastSyncTime) / 1000;
  return Math.min(state.lastKnownPosition + elapsed, state.duration);
}
```

---

## 8. Track Info Component

Minimal typography block. Below the vinyl, centered.

### 8.1 Layout

```
[Track Title]        ← large, --ui-text-primary, sf-pro-display or system-ui
[Artist · Album]     ← small, --ui-text-secondary
```

### 8.2 Animation on Track Change

When `track` changes, animate out the old text (opacity: 0, y: -8px) and in the new text (opacity: 1, y: 0) using `AnimatePresence` with `key={track}`.

```typescript
<AnimatePresence mode="wait">
  <motion.div
    key={track}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
  >
    <h2 className="track-title">{track}</h2>
    <p className="track-meta">{artist}{album ? ` · ${album}` : ""}</p>
  </motion.div>
</AnimatePresence>
```

---

## 9. Controls Component

Minimal playback controls. Three buttons: Previous, Play/Pause, Next.

### 9.1 Design

- Float just below the track info
- Each button: circular, ~44px diameter (accessible touch/click target)
- Background: `var(--ui-control-hover)` on hover
- Scale spring on tap/click: `whileTap={{ scale: 0.88 }}`
- Icon: SVG icons, stroke-based, `currentColor`, ~20px
- Play/Pause: slightly larger than Prev/Next (52px)

### 9.2 Visibility

In **Main View**: always visible.  
In **Fullscreen View**: hidden until mouse moves, then fade in for 2 seconds.  
In **Mini View**: always visible, more compact.

```typescript
// Controls visibility in fullscreen (CSS + Motion):
// Wrap controls in a motion.div.
// On mousemove over document: set visible = true, reset a 2s timer.
// When timer fires: visible = false.
// Animate opacity 0 ↔ 1 with transition duration 400ms.
```

### 9.3 Disabled State

If `canControl === false` from PlaybackState: render controls at 30% opacity, pointer-events: none. Do not hide them — user should see them and understand the source app doesn't support control.

---

## 10. Playback State Transitions — Full Spec

This is the core animation choreography. Every state change triggers a specific sequence.

### 10.1 Track Change (new song starts)

Sequence (all overlap, not sequential):
1. **t=0ms:** Ambient orbs begin cross-fading to new colors (CSS transition, 800ms)
2. **t=0ms:** Vinyl label cross-fades: old artwork → blurred → new artwork (300ms)
3. **t=0ms:** Track info animates out (exit: opacity 0, y -8, 350ms)
4. **t=200ms:** Track info animates in with new data (enter: opacity 1, y 0, 350ms)
5. **t=0ms:** If was paused and now playing: needle arm lowers (spring, ~600ms)
6. **Vinyl continues spinning** — no spin interruption on track change. Rotation angle is never reset on track change.

**Label cross-fade implementation:**
```typescript
// Use AnimatePresence with key={artworkDataUrl}
// Exit: opacity 0, scale 0.95, duration 250ms
// Enter: opacity 1, scale 1, duration 350ms
// mode="wait": wait for exit before entering
```

### 10.2 Play (from paused state)

Sequence:
1. **t=0ms:** Needle arm begins lowering (spring: stiffness 60, damping 18, ~600ms settle)
2. **t=0ms:** Vinyl starts spinning up (via useVinylRotation velocity lerp, ~300ms to full speed)
3. **t=100ms:** Glow bloom increases opacity (CSS transition 600ms)
4. **t=0ms:** Progress ring resumes advancing (client-side extrapolation)

### 10.3 Pause (from playing state)

Sequence:
1. **t=0ms:** Vinyl begins decelerating (velocity lerp to 0, ~800ms to full stop with inertia)
2. **t=200ms:** Needle arm begins lifting (spring, ~600ms settle) — slight delay makes it feel like the arm waits for the record to slow
3. **t=200ms:** Glow bloom decreases opacity (CSS transition 800ms)
4. **t=0ms:** Progress ring freezes

### 10.4 Seek (user drags progress ring — if supported)

1. Call `playbackSource.seekTo(seconds)` immediately
2. Update local `lastKnownPosition` optimistically
3. If SMTC confirms with a new position event within 1s: accept it
4. If not confirmed in 1s: revert to pre-seek position (SMTC didn't support seek)

### 10.5 Source Change (SMTC switches to a different app)

When the active SMTC session changes (e.g., user starts playing in a different app):
1. Brief full-screen fade (opacity to 0.85 and back, 300ms): signals to user that the source changed
2. Show source name badge for 2s ("Now from: Spotify" → "Now from: YouTube Music")
3. Full track change sequence

---

## 11. Fullscreen Mode

### 11.1 Layout Differences vs Main View

| Element | Main View | Fullscreen View |
|---|---|---|
| Vinyl size | 420px | 55vmin |
| Track info | Below vinyl | Below vinyl, larger type |
| Controls | Always visible | Hidden, shown on mousemove for 2s |
| Source badge | Bottom right corner | Same |
| Theme picker | Accessible | Hidden, shown with controls |
| Background | Ambient layer | Ambient layer + edge vignette stronger |

### 11.2 Entry/Exit Animation

- **Enter fullscreen:** Window goes borderless/maximized. Content scales up (Motion `layoutId` or scale transition from main to fullscreen). Duration: 400ms spring.
- **Exit fullscreen:** Reverse. Press Escape or click exit button.

In Tauri, fullscreen is triggered via:
```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";
getCurrentWindow().setFullscreen(true);
```

---

## 12. Mini Player / Compact Mode

### 12.1 Window Dimensions

- Size: 280×280px (square), 320×100px (horizontal bar variant)
- Always on top: `true`
- Frameless: `true`
- Resizable: `false`
- Transparent background possible (with compositor support)

### 12.2 Square Layout (280×280)

```
[ ambient background fills window ]
    [ vinyl: 160px, centered, offset slightly up ]
    [ needle: small, proportional ]
    [ title: 1 line, truncated, 12px ]
    [ controls: 32px icons, below ]
```

### 12.3 Horizontal Bar Layout (320×100)

```
[ album art: 80px square left ] [ title + artist: center ] [ play/pause + skip: right ]
```

Mini player does not have the needle arm in horizontal bar mode — it would be too cramped.

### 12.4 Drag to Move

The mini player window must be draggable. In Tauri: add `data-tauri-drag-region` attribute to the background element.

```html
<div class="mini-player-root" data-tauri-drag-region>
```

### 12.5 Context Menu on Right-Click

Right-click anywhere on the mini player shows:
- Switch to Main View
- Switch to Fullscreen
- Theme (submenu: Noir / Glass / Aurora / Vapor / Paper)
- Always on Top (checkmark toggle)
- Quit VinylDeck

---

## 13. Source Badge

A small pill in the lower-right corner (main and fullscreen) showing where the music is coming from.

```
[ ◉ Spotify ]    ← --ui-text-secondary color, 11px, opacity 0.6
```

- Appears for 3s when the source first loads or changes
- Persists at 0.3 opacity when hovered
- Clicking it does nothing (informational only)
- If `sourceName` is empty: hide it entirely

---

## 14. Settings Panel

A slide-in panel from the right (or bottom on compact) accessible via a gear icon.

### 14.1 Settings Options

| Setting | Type | Default |
|---|---|---|
| Theme | Select (5 options) | noir |
| Window mode | Select (Main / Fullscreen / Mini) | main |
| Always on top | Toggle | false |
| Mini player layout | Select (Square / Horizontal) | square |
| Reduce motion | Toggle | false (respects `prefers-reduced-motion`) |
| Reduce blur | Toggle | false |
| Startup behavior | Select (Open main / Open mini / Hidden) | main |
| Show source badge | Toggle | true |

### 14.2 Reduce Blur

When enabled, set `--ambient-blur: 0px` and remove `filter: blur()` from ambient orbs. Replaces with a solid very dark color. This is for performance on weak integrated graphics.

### 14.3 Reduce Motion

When enabled:
- No vinyl inertia (instant stop/start)
- No spring transitions (linear or none)
- No glow pulsing
- Ambient color changes: instant

Respect `prefers-reduced-motion` media query automatically and also provide a manual toggle.

### 14.4 Settings Persistence

Save to Tauri's `store` plugin (or a simple JSON file via `fs` plugin in `AppData/VinylDeck/settings.json`).

```typescript
// src/lib/settings.ts
// On app start: load settings → apply theme → apply window mode
// On any setting change: save immediately (debounced 500ms)
```

---

## 15. Performance Budget

| Metric | Target | Hard Limit |
|---|---|---|
| Initial load time | < 800ms to first paint | < 1.5s |
| Vinyl rotation frame time | < 2ms | < 4ms |
| Track change total animation | < 100ms to start | — |
| Memory usage (resident) | < 120MB | < 180MB |
| CPU at idle (vinyl spinning) | < 2% | < 5% |
| CPU during track change | < 15% spike | — |

**Key rule:** Never use `setInterval` or `setTimeout` for animations. Use `requestAnimationFrame` or Motion/CSS animations exclusively.

**Key rule:** Never animate CSS properties that trigger layout (width, height, top, left, margin, padding). Only animate `transform` and `opacity` via JS. Use CSS transitions for color changes.
