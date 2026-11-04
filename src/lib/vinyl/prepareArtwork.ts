// src/lib/vinyl/prepareArtwork.ts
// Readies an image for both places it can go, and decides where it goes: the user's
// choice when there is one, otherwise a photo of a record fills the disc and anything
// else goes on the center label.

import type { ArtPlacement } from "../discogs/types";
import { trimArtworkMargins } from "./artworkTrim";
import { cropDiscSurface, findDiscInImage } from "./discPhoto";

export interface PreparedArtwork {
  /** The image without its white margin. */
  labelSrc: string;
  /** For the whole disc: cropped to the rim if it is a photo of a record. */
  surfaceSrc: string;
  /** The photographed label's radius as a fraction of the disc's, for a record photo. */
  discLabelRatio: number | null;
}

export interface PlacedArtwork {
  src: string;
  wholeDisc: boolean;
  discLabelRatio: number | null;
}

export async function prepareArtwork(src: string): Promise<PreparedArtwork> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return { labelSrc: src, surfaceSrc: src, discLabelRatio: null };
  }

  const labelSrc = trimArtworkMargins(image, src);
  try {
    const disc = findDiscInImage(image);
    const surface = disc ? cropDiscSurface(image, disc) : null;
    if (disc && surface) {
      return { labelSrc, surfaceSrc: surface, discLabelRatio: disc.labelRatio };
    }
  } catch (error) {
    // The plain image still works everywhere.
    console.warn("[VinylDeck] Disc photo analysis failed:", error);
  }

  return { labelSrc, surfaceSrc: labelSrc, discLabelRatio: null };
}

export function placeArtwork(
  prepared: PreparedArtwork,
  mode: ArtPlacement["mode"],
): PlacedArtwork {
  const wholeDisc =
    mode === "disc" || (mode === "auto" && prepared.discLabelRatio !== null);
  return wholeDisc
    ? {
        src: prepared.surfaceSrc,
        wholeDisc,
        discLabelRatio: prepared.discLabelRatio,
      }
    : { src: prepared.labelSrc, wholeDisc, discLabelRatio: null };
}
