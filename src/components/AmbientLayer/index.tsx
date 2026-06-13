// src/components/AmbientLayer/index.tsx
// Fixed full-bleed shell lighting. The vinyl remains the hero; this layer only
// provides the physical room: Noir velvet or Glass liquid optics.

import { useEffect } from "react";
import { applyAmbientMode } from "../../lib/themes/applier";
import type { AmbientModeId, ThemeId } from "../../lib/themes/applier";
import "./AmbientLayer.css";

interface AmbientLayerProps {
  filmGrain?: boolean;
  mode?: AmbientModeId;
  theme?: ThemeId;
}

export function AmbientLayer({
  filmGrain = true,
  mode = "off",
  theme = "noir",
}: AmbientLayerProps) {
  useEffect(() => {
    applyAmbientMode(mode);
  }, [mode]);

  return (
    <div
      className={`ambient-layer ambient-layer--${mode} ambient-layer--theme-${theme}`}
      aria-hidden="true"
    >
      <svg className="ambient-layer__defs" focusable="false" aria-hidden="true">
        <filter
          id="liquid-caustic-displace"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.05"
            numOctaves="3"
            seed="9"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="28"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <div className="ambient-layer__base" />
      <div className="ambient-layer__velvet" />

      <div className="ambient-layer__beam ambient-layer__beam--a" />
      <div className="ambient-layer__beam ambient-layer__beam--b" />
      <div className="ambient-layer__beam ambient-layer__beam--c" />

      <div className="ambient-layer__reflection" />
      <div className="ambient-layer__caustic" />
      <div className="ambient-layer__caustic ambient-layer__caustic--fine" />
      <div className="ambient-layer__glass-orb" />

      <div className="ambient-layer__aurora ambient-layer__aurora--a" />
      <div className="ambient-layer__aurora ambient-layer__aurora--b" />

      <div className="ambient-layer__vignette" />
      {filmGrain && <div className="ambient-layer__grain" />}
    </div>
  );
}
