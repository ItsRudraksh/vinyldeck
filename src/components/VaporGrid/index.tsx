// src/components/VaporGrid/index.tsx
// Phase 6.3 — Vapor theme exclusive OutRun grid floor.
// Pure CSS animation — no JS after mount.
// Only renders when data-theme="vapor" is active.

import { useVinylDeckStore } from "../../lib/playback/store";
import "./VaporGrid.css";

export function VaporGrid() {
  const theme = useVinylDeckStore((s) => s.theme);

  if (theme !== "vapor") return null;

  return (
    <div className="vapor-grid" aria-hidden="true">
      {/* 3D perspective floor grid — pure CSS animation */}
      <div className="vapor-grid__plane" />
    </div>
  );
}
