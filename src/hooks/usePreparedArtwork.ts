// src/hooks/usePreparedArtwork.ts
// Keeps the current artwork on screen until its replacement is ready, so a change never
// flashes a bare record. When artwork goes away, it goes away immediately.

import { useEffect, useState } from "react";
import type { ArtPlacement } from "../lib/discogs/types";
import { placeArtwork, prepareArtwork } from "../lib/vinyl/prepareArtwork";
import type { PlacedArtwork, PreparedArtwork } from "../lib/vinyl/prepareArtwork";

export function usePreparedArtwork(
  artworkDataUrl: string | null,
  mode: ArtPlacement["mode"],
): PlacedArtwork | null {
  const [prepared, setPrepared] = useState<PreparedArtwork | null>(null);

  useEffect(() => {
    if (!artworkDataUrl) {
      setPrepared(null);
      return;
    }

    let cancelled = false;
    void prepareArtwork(artworkDataUrl).then((next) => {
      if (!cancelled) setPrepared(next);
    });
    return () => {
      cancelled = true;
    };
  }, [artworkDataUrl]);

  return artworkDataUrl && prepared ? placeArtwork(prepared, mode) : null;
}
