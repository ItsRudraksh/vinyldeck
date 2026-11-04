// src/components/VinylRecord/ArtworkFit.tsx
// An image placed on its circular area. Shared by the record and the adjust preview,
// so what the preview shows is what the record gets.

import { useEffect, useState } from "react";
import type { ArtPlacement } from "../../lib/discogs/types";
import { coverBox, placementTransform } from "../../lib/vinyl/artworkFit";

interface ArtworkLayer {
  src: string;
  aspect: number;
}

/**
 * Crossfades on change. The incoming image is decoded before it is shown, and the
 * outgoing one stays underneath until the fade ends, so a swap never exposes what is
 * behind it. Opacity-only: the disc's RAF rotation is untouched.
 */
export function ArtworkFit({
  src,
  alt,
  placement,
}: {
  src: string;
  alt: string;
  placement: ArtPlacement;
}) {
  const [layers, setLayers] = useState<ArtworkLayer[]>([]);

  useEffect(() => {
    let cancelled = false;
    const incoming = new Image();
    const showIncoming = () => {
      if (cancelled) return;
      const aspect = incoming.naturalWidth / incoming.naturalHeight;
      setLayers((current) =>
        current[current.length - 1]?.src === src
          ? current
          : [...current.slice(-1), { src, aspect }],
      );
    };

    incoming.src = src;
    incoming.decode().then(showIncoming, showIncoming);

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className="vinyl-artwork-fit"
      style={{ transform: placementTransform(placement) }}
    >
      {layers.map((layer, index) => {
        const isTop = index === layers.length - 1;
        const box = coverBox(layer.aspect);
        return (
          <img
            key={layer.src}
            className={isTop ? "vinyl-artwork-fit__entering" : undefined}
            src={layer.src}
            alt={isTop ? alt : ""}
            draggable={false}
            style={{
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
            }}
            onAnimationEnd={
              isTop ? () => setLayers((current) => current.slice(-1)) : undefined
            }
          />
        );
      })}
    </div>
  );
}
