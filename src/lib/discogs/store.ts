// src/lib/discogs/store.ts
// Runtime-only state for the album on the deck. Lives apart from PlaybackState,
// whose interface is locked, and is never persisted here: the backend owns that.

import { create } from "zustand";
import { DEFAULT_ART_PLACEMENT } from "./types";
import type { AlbumArt, ArtPlacement } from "./types";

interface AlbumArtStoreState {
  /** The album `art` belongs to. Guards against showing one album's art on another. */
  identity: string | null;
  art: AlbumArt | null;

  setCurrentAlbum(identity: string | null): void;
  applyResolved(identity: string, art: AlbumArt): void;
  /** Backend-pushed update, applied only if it concerns the album on the deck. */
  applyChange(art: AlbumArt): void;
  /** Shows a choice right away, before the full-size image arrives. */
  previewSelection(imageId: string, previewDataUrl: string | null): void;
  /** Shows a placement right away, before it is saved. */
  previewPlacement(placement: ArtPlacement): void;
}

export const useAlbumArtStore = create<AlbumArtStoreState>()((set) => ({
  identity: null,
  art: null,

  setCurrentAlbum(identity) {
    set((state) =>
      state.identity === identity ? state : { identity, art: null },
    );
  },

  applyResolved(identity, art) {
    set((state) => (state.identity === identity ? { art } : state));
  },

  applyChange(art) {
    set((state) => (state.art?.key === art.key ? { art } : state));
  },

  previewSelection(imageId, previewDataUrl) {
    set((state) =>
      state.art
        ? {
            art: {
              ...state.art,
              selectedImageId: imageId,
              artworkDataUrl: previewDataUrl ?? state.art.artworkDataUrl,
              // The backend answers with this image's own saved placement.
              placement: DEFAULT_ART_PLACEMENT,
              selectedReleaseId: null,
            },
          }
        : state,
    );
  },

  previewPlacement(placement) {
    set((state) =>
      state.art ? { art: { ...state.art, placement } } : state,
    );
  },
}));

/**
 * Art for the album playing right now. Comparing identities during render closes
 * the one-frame gap after a track change in which the store still holds the
 * previous album's art.
 */
export function artForAlbum(
  storedIdentity: string | null,
  storedArt: AlbumArt | null,
  currentIdentity: string | null,
): AlbumArt | null {
  if (currentIdentity === null || storedIdentity !== currentIdentity) {
    return null;
  }
  return storedArt;
}
