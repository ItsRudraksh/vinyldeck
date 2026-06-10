// src/hooks/useColorExtraction.ts
// Ambient color extraction — fast-average-color, simple algorithm.
//
// FINAL approach (2026-06-08):
//   algorithm: 'simple' — straight weighted average of all pixels.
//   Tested dominant (worst), sqrt (grey cancellation on complex photos),
//   simple (best across all art types — keeps overall mood, no cluster bias).
//
// Post-process: HSL saturation boost + lightness clamp → vivid ambient bloom.
// Single color → both orbs → uniform cinematic wash.

import { useEffect, useRef } from "react";
import { FastAverageColor } from "fast-average-color";
import { applyAmbientColors, resetAmbientColors } from "../lib/themes/applier";

const fac = new FastAverageColor();

// ── HSL helpers ────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255,
    gf = g / 255,
    bf = b / 255;
  const max = Math.max(rf, gf, bf),
    min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rf:
      h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
      break;
    case gf:
      h = ((bf - rf) / d + 2) / 6;
      break;
    case bf:
      h = ((rf - gf) / d + 4) / 6;
      break;
  }
  return [h, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Boost a raw average color into a vivid ambient bloom color.
 * Returns "" if the color is near-achromatic (no usable hue).
 *
 * Saturation: boosted to min 0.55 so muted averages still bloom visibly.
 * Lightness:  clamped 0.25–0.50 — bright enough for screen-blend, not blinding.
 */
function boostToAmbient(r: number, g: number, b: number): string {
  let [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.05) return ""; // near-achromatic — no usable hue
  s = Math.min(Math.max(s, 0.55), 0.9);
  l = Math.min(Math.max(l, 0.25), 0.5);
  const [rb, gb2, bb] = hslToRgb(h, s, l);
  return `rgb(${rb},${gb2},${bb})`;
}

/**
 * Extract ambient color via fast-average-color `simple` algorithm.
 * Simple = straight weighted average of all sampled pixels.
 * Best for general album art across all types (portraits, landscapes, solid covers).
 */
export async function extractAmbientColors(artworkSrc: string): Promise<{
  primary: string;
  secondary: string;
} | null> {
  try {
    const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = artworkSrc;
    });

    const result = await fac.getColorAsync(imgEl, {
      algorithm: "simple",
      mode: "precision",
      ignoredColor: [
        [255, 255, 255, 255, 25] as [number, number, number, number, number],
        [0, 0, 0, 255, 15] as [number, number, number, number, number],
      ],
    });

    if (result.error) return null;

    const [r, g, b] = result.value;
    const color = boostToAmbient(r, g, b);

    if (!color) {
      console.debug(
        `[VinylDeck] near-achromatic rgb(${r},${g},${b}) → theme fallback`,
      );
      return null;
    }

    console.debug(`[VinylDeck] ambient: raw=rgb(${r},${g},${b}) → ${color}`);
    return { primary: color, secondary: color };
  } catch (err) {
    console.warn("[VinylDeck] Color extraction failed:", err);
    return null;
  }
}

/**
 * React hook: watches artworkDataUrl, extracts ambient color, applies to DOM.
 * Stale-safe — aborts in-flight extraction if track changes mid-flight.
 */
export function useColorExtraction(artworkDataUrl: string | null): void {
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    abortRef.current = false;

    if (!artworkDataUrl) {
      resetAmbientColors();
      return;
    }

    extractAmbientColors(artworkDataUrl).then((result) => {
      if (abortRef.current) return;
      if (result) {
        applyAmbientColors(result.primary, result.secondary);
      } else {
        resetAmbientColors();
      }
    });

    return () => {
      abortRef.current = true;
    };
  }, [artworkDataUrl]);
}
