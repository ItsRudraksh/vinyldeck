// src/components/AmbientLayer/index.tsx
// Fixed full-bleed background: blurred orbs + vignette + film grain.
// Colors driven by CSS custom properties --ambient-primary/secondary.
// Phase 1: Added floatOrb-a/b drift + center heartbeat orb (orb-center).

import "./AmbientLayer.css";

export function AmbientLayer() {
  return (
    <div className="ambient-layer" aria-hidden="true">
      {/* Primary orb — upper-left, floats with floatOrb-a (23s) */}
      <div className="ambient-layer__orb-primary" />

      {/* Secondary orb — lower-right, floats with floatOrb-b (19s, offset) */}
      <div className="ambient-layer__orb-secondary" />

      {/* Center heartbeat orb — sits directly behind the disc */}
      {/* Phase 1.3: breathe-center 6s, smaller + more focused */}
      <div className="ambient-layer__orb-center" />

      {/* Radial vignette — darkens edges for cinematic depth */}
      <div className="ambient-layer__vignette" />

      {/* Film grain — procedural SVG noise at 3.5% opacity, top layer */}
      <div className="ambient-layer__grain" />
    </div>
  );
}
