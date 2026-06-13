// src/components/VinylRecord/index.tsx
// Hybrid Pressing Studio renderer:
//   - Canvas-baked wax maps + raw WebGL shader for physical disc material
//   - Existing CSS stack remains as a graceful fallback
//   - CSS label/hole/outer stage stay DOM for simplicity and accessibility

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useVinylRotation } from "../../hooks/useVinylRotation";
import { VinylShaderCanvas } from "./VinylShaderCanvas.tsx";
import type { VinylShaderHandle } from "./VinylShaderCanvas.tsx";
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
  const shaderRef = useRef<VinylShaderHandle>(null);
  const [shaderReady, setShaderReady] = useState(false);

  // Single RAF loop: rotates the DOM disc for label/fallback and feeds the
  // same rotation/velocity to the shader for light-reactive grooves.
  useVinylRotation({
    isPlaying,
    onFrame: ({ rotation, velocity }) => {
      shaderRef.current?.setRotation(rotation, velocity);
    },
  });

  // Mouse-tracking specular highlight. CSS fallback gets the angle variable;
  // WebGL gets normalized mouse coordinates relative to the disc.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const disc = document.getElementById("vinyl-disc");
    if (!disc) return;

    const rect = disc.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle =
      Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    sheenRef.current?.style.setProperty("--vinyl-rotation", `${angle + 90}deg`);

    const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (e.clientY - rect.top) / Math.max(rect.height, 1);
    shaderRef.current?.setMouse(x, y);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const ghostArtworkStyle = artworkDataUrl
    ? ({ backgroundImage: `url(${artworkDataUrl})` } as CSSProperties)
    : undefined;
  const fallbackLabel = trackTitle
    ? trackTitle.charAt(0).toUpperCase()
    : "VINYLDECK";
  const isEmptyLabel = !trackTitle;

  return (
    <div
      className={`vinyl-wrapper${isPlaying && vinylWobble ? " vinyl-wrapper--playing" : ""}${shaderReady ? " vinyl-wrapper--shader-ready" : " vinyl-wrapper--css-renderer"}`}
      style={{ "--vinyl-size": `${size}px` } as CSSProperties}
      data-renderer={shaderReady ? "webgl" : "css"}
    >
      {/* SVG turbulence remains for the CSS fallback renderer. */}
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

      <div className={`vinyl-glow${isPlaying ? " playing" : ""}`} />
      <div className="vinyl-counter-a" />
      <div className="vinyl-counter-b" />

      <div
        className="vinyl-disc"
        id="vinyl-disc"
        aria-label={`Vinyl record${isPlaying ? " spinning" : " paused"}`}
      >
        {artworkDataUrl && (
          <div className="vinyl-translucent-ghost" style={ghostArtworkStyle} />
        )}

        <VinylShaderCanvas
          ref={shaderRef}
          artworkDataUrl={artworkDataUrl}
          size={size}
          onReadyChange={setShaderReady}
        />

        {/* CSS fallback layers. Hidden once the shader renderer is live. */}
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
