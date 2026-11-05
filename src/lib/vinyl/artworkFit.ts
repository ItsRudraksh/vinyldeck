// src/lib/vinyl/artworkFit.ts
// Geometry of an image on the circular area it fills: the center label or the whole disc.
// An image is laid out at full size, overflowing the area instead of being clipped by
// object-fit, so panning can reach every part of a non-square image.

import type { ArtPlacement } from "../discogs/types";

const MIN_ZOOM_PERCENT = 50;
const MAX_ZOOM_PERCENT = 300;

/** Position and size that cover a square area, as percentages of it. */
export interface CoverBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function coverBox(aspect: number): CoverBox {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const width = safeAspect >= 1 ? safeAspect * 100 : 100;
  const height = safeAspect >= 1 ? 100 : 100 / safeAspect;
  return {
    left: (100 - width) / 2,
    top: (100 - height) / 2,
    width,
    height,
  };
}

export function placementTransform(placement: ArtPlacement): string {
  return `translate(${placement.offsetX}%, ${placement.offsetY}%) scale(${placement.zoomPercent / 100})`;
}

/** The zoom at which the whole image, corners included, fits inside the circle. */
export function fitZoomPercent(aspect: number): number {
  const box = coverBox(aspect);
  const diagonal = Math.hypot(box.width, box.height);
  return clampZoomPercent(Math.floor((100 / diagonal) * 100));
}

export function clampZoomPercent(zoomPercent: number): number {
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent));
}
