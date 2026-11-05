// src/hooks/useAlbumArtwork.ts
// Follows the album on the deck and picks the artwork to press onto the vinyl:
// Discogs image → the player's own artwork → the label's existing fallback (null).
// Failures never reach playback: the record just keeps the art it can show.

import { useEffect } from "react";
import {
  albumIdentity,
  isAlbumArtAvailable,
  resolveAlbumArt,
  subscribeToAlbumArtChanges,
} from "../lib/discogs";
import { artForAlbum, useAlbumArtStore } from "../lib/discogs/store";
import type { AlbumArt } from "../lib/discogs/types";

const MIN_RETRY_SECONDS = 5;

export function useAlbumArtwork(
  artist: string,
  album: string,
  playerArtworkDataUrl: string | null,
): { artworkDataUrl: string | null; art: AlbumArt | null } {
  const identity = albumIdentity(artist, album);
  const storedIdentity = useAlbumArtStore((state) => state.identity);
  const storedArt = useAlbumArtStore((state) => state.art);

  useEffect(() => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(identity);
    if (identity === null || !isAlbumArtAvailable()) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function lookup(albumId: string) {
      resolveAlbumArt(artist, album)
        .then((art) => {
          if (cancelled) return;
          useAlbumArtStore.getState().applyResolved(albumId, art);
          if (art.retryAfterSeconds !== null) {
            const seconds = Math.max(art.retryAfterSeconds, MIN_RETRY_SECONDS);
            retryTimer = setTimeout(() => lookup(albumId), seconds * 1000);
          }
        })
        .catch((error) => {
          console.warn("[Discogs] Album lookup failed:", error);
        });
    }

    lookup(identity);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // Artist and album spelling may vary across tracks; identity is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  useEffect(() => {
    if (!isAlbumArtAvailable()) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    subscribeToAlbumArtChanges((art) => {
      useAlbumArtStore.getState().applyChange(art);
    })
      .then((stop) => {
        if (disposed) stop();
        else unsubscribe = stop;
      })
      .catch((error) => {
        console.warn("[Discogs] Art event subscription failed:", error);
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const art = artForAlbum(storedIdentity, storedArt, identity);
  return {
    artworkDataUrl: art?.artworkDataUrl ?? playerArtworkDataUrl,
    art,
  };
}
