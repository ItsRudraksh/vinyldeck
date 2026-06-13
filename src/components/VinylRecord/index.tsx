// src/components/VinylRecord/index.tsx
// Layer stack (bottom → top):
//   0: vinyl-glow (bloom behind disc)
//   1: vinyl-counter-a (fixed-light conic reflection — outside disc)
//   2: vinyl-counter-b (fixed-light conic reflection — outside disc)
//   3: vinyl-disc (rotates via RAF)
//       3a: vinyl-translucent-ghost blurred artwork visible through clear/smoke pressings
//       3b: vinyl-pressing-base     album-derived colored wax material
//       3c: vinyl-pressing-texture  marble / splatter / translucent / split personality
//       3d: vinyl-pressing-depth    edge thickness + inner physical depth
//       3e: vinyl-grooves           responsive record groove ridges
//       3f: vinyl-sheen             mouse-driven specular highlight
//       3g: vinyl-reflection        static studio-light reflection
//       3h: vinyl-label-ring        softened print boundary
//       3i: vinyl-label             album art or fallback
//       3j: vinyl-hole              spindle hole

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useVinylRotation } from "../../hooks/useVinylRotation";
import "./VinylRecord.css";
import "./pressings.css";

interface VinylRecordProps {
  isPlaying: boolean;
  vinylWobble?: boolean;
  artworkDataUrl: string | null;
  trackTitle: string;
  size?: number; // px, default 420
}

export function VinylRecord({
  isPlaying,
  vinylWobble = true,
  artworkDataUrl,
  trackTitle,
  size = 420,
}: VinylRecordProps) {
  const sheenRef = useRef<HTMLDivElement>(null);

  // RAF rotation with inertia — pure DOM mutation, no re-renders.
  useVinylRotation({ isPlaying });

  // Mouse-tracking specular highlight.
  // Direct DOM mutation — zero React re-renders on mousemove.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!sheenRef.current) return;
    const disc = document.getElementById("vinyl-disc");
    if (!disc) return;

    const rect = disc.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle =
      Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    sheenRef.current.style.setProperty("--vinyl-rotation", `${angle + 90}deg`);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Empty app state uses a brand wordmark; artwork-missing tracks use first letter.
  const ghostArtworkStyle = artworkDataUrl
    ? ({ backgroundImage: `url(${artworkDataUrl})` } as CSSProperties)
    : undefined;
  const fallbackLabel = trackTitle
    ? trackTitle.charAt(0).toUpperCase()
    : "VINYLDECK";
  const isEmptyLabel = !trackTitle;

  return (
    <div
      className={`vinyl-wrapper${isPlaying && vinylWobble ? " vinyl-wrapper--playing" : ""}`}
      style={{ "--vinyl-size": `${size}px` } as CSSProperties}
    >
      {/* SVG turbulence is static; CSS chooses when to use it for organic marble/wax texture. */}
      <svg className="vinyl-filter-defs" aria-hidden="true" focusable="false">
        <filter
          id="vinyl-marble-turbulence"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014 0.038"
            numOctaves="5"
            seed="7"
            stitchTiles="stitch"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="24"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          id="vinyl-splatter-warp"
          x="-12%"
          y="-12%"
          width="124%"
          height="124%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.055 0.09"
            numOctaves="3"
            seed="11"
            stitchTiles="stitch"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* Layer 0: Glow bloom — behind everything */}
      <div className={`vinyl-glow${isPlaying ? " playing" : ""}`} />

      {/* Layers 1–2: Fixed light-source reflection overlays outside the rotating disc. */}
      <div className="vinyl-counter-a" />
      <div className="vinyl-counter-b" />

      {/* Layer 3: The disc — rotation applied via RAF on id="vinyl-disc" */}
      <div
        className="vinyl-disc"
        id="vinyl-disc"
        aria-label={`Vinyl record${isPlaying ? " spinning" : " paused"}`}
      >
        {artworkDataUrl && (
          <div className="vinyl-translucent-ghost" style={ghostArtworkStyle} />
        )}
        <div className="vinyl-pressing-base" />
        <div className="vinyl-pressing-texture" />
        <div className="vinyl-pressing-depth" />
        <div className="vinyl-grooves" />
        <div className="vinyl-sheen" ref={sheenRef} />
        <div className="vinyl-reflection" />
        <div className="vinyl-label-ring" />

        <div className="vinyl-label">
          {artworkDataUrl ? (
            <img src={artworkDataUrl} alt={trackTitle} draggable={false} />
          ) : (
            <div
              className={`vinyl-label-fallback${isEmptyLabel ? " vinyl-label-fallback--empty" : ""}`}
            >
              <span>{fallbackLabel}</span>
            </div>
          )}
        </div>

        <div className="vinyl-hole" />
      </div>
    </div>
  );
}
