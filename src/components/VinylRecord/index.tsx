// src/components/VinylRecord/index.tsx
// Layer stack (bottom → top):
//   0: vinyl-glow (bloom behind disc)
//   1: vinyl-counter-a (counter-clockwise conic, OUTSIDE disc — fixed light)
//   2: vinyl-counter-b (clockwise conic, OUTSIDE disc — fixed light)
//   3: vinyl-disc (base plate — rotates via RAF)
//       3a: vinyl-grooves (repeating-radial-gradient texture)
//       3b: vinyl-sheen (conic specular, mouse-driven)
//       3c: vinyl-reflection (static inner-glow highlight)
//       3d: vinyl-label (center artwork or fallback)
//       3e: vinyl-hole (spindle)
//
// Phase 2 changes:
//   - vinyl-wrapper gets --playing class → vinylWobble animation
//   - vinyl-counter-a/b moved OUTSIDE vinyl-disc so they don't rotate
//   - specular sheen opacity lifted to 0.28 (was 0.07 — invisible)
//   - vinyl-reflection simplified to radial inner highlight

import { useRef, useEffect, useCallback } from "react";
import { useVinylRotation } from "../../hooks/useVinylRotation";
import "./VinylRecord.css";

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

  // RAF rotation with inertia — pure DOM mutation, no re-renders
  useVinylRotation({ isPlaying });

  // Phase 2.4: Mouse-tracking specular highlight
  // Direct DOM mutation — zero React re-renders on mousemove
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!sheenRef.current) return;
    const disc = document.getElementById("vinyl-disc");
    if (!disc) return;
    const rect = disc.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    // Direct style mutation — bypasses React render cycle entirely
    sheenRef.current.style.setProperty("--vinyl-rotation", `${angle + 90}deg`);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Empty app state uses a brand wordmark; artwork-missing tracks use first letter.
  const fallbackLabel = trackTitle ? trackTitle.charAt(0).toUpperCase() : "VINYLDECK";
  const isEmptyLabel = !trackTitle;

  return (
    <div
      className={`vinyl-wrapper${isPlaying && vinylWobble ? " vinyl-wrapper--playing" : ""}`}
      style={{ "--vinyl-size": `${size}px` } as React.CSSProperties}
    >
      {/* Layer 0: Glow bloom — behind everything */}
      <div className={`vinyl-glow${isPlaying ? " playing" : ""}`} />

      {/* Layers 1–2: Counter-rotating reflection overlays (OUTSIDE disc)  */}
      {/* These are fixed-light-source layers — they do NOT rotate with     */
      /* the disc. They simulate a real overhead studio lamp catching the   */
      /* groove ridges from a fixed angle while the record turns beneath.  */}
      <div className="vinyl-counter-a" />
      <div className="vinyl-counter-b" />

      {/* Layer 3: The disc — rotation applied via RAF on id="vinyl-disc" */}
      <div
        className="vinyl-disc"
        id="vinyl-disc"
        aria-label={`Vinyl record${isPlaying ? " spinning" : " paused"}`}
      >
        {/* Layer 3a: Groove texture */}
        <div className="vinyl-grooves" />

        {/* Layer 3b: Specular mouse-driven sheen — opacity tuned to 0.28 */}
        <div className="vinyl-sheen" ref={sheenRef} />

        {/* Layer 3c: Static inner-glow highlight (radial, not conic) */}
        <div className="vinyl-reflection" />

        {/* Layer 3d: Center label — artwork or fallback letter */}
        <div className="vinyl-label">
          {artworkDataUrl ? (
            <img
              src={artworkDataUrl}
              alt={trackTitle}
              draggable={false}
            />
          ) : (
            <div className={`vinyl-label-fallback${isEmptyLabel ? " vinyl-label-fallback--empty" : ""}`}>
              <span>{fallbackLabel}</span>
            </div>
          )}
        </div>

        {/* Layer 3e: Spindle hole */}
        <div className="vinyl-hole" />
      </div>
    </div>
  );
}
