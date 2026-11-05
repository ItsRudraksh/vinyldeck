// src/components/ArtworkPicker/useAlbumThumbnails.ts

import { useEffect, useState } from "react";
import { fetchAlbumArtThumbnail } from "../../lib/discogs";
import type { AlbumArtImage } from "../../lib/discogs/types";

export type ThumbnailState = string | "failed";

/** Loads thumbnails as they arrive; the backend caps concurrency and caches them. */
export function useAlbumThumbnails(
  albumKey: string,
  images: AlbumArtImage[],
): Record<string, ThumbnailState> {
  const [thumbnails, setThumbnails] = useState<Record<string, ThumbnailState>>(
    {},
  );
  const imageIds = images.map((image) => image.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setThumbnails({});

    for (const image of images) {
      fetchAlbumArtThumbnail(albumKey, image.id)
        .then((thumbnail): ThumbnailState => thumbnail ?? "failed")
        .catch((): ThumbnailState => "failed")
        .then((state) => {
          if (cancelled) return;
          setThumbnails((current) => ({ ...current, [image.id]: state }));
        });
    }

    return () => {
      cancelled = true;
    };
    // Reload only for a different image set, not for each selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumKey, imageIds]);

  return thumbnails;
}
