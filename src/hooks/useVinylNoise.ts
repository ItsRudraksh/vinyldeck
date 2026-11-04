// src/hooks/useVinylNoise.ts
// Keeps surface noise in step with the record: it plays only while a track plays.
// Mount this in the main window only. That window lives for the whole session (it is
// hidden, not destroyed, while Mini is open), so the noise never doubles up.

import { useEffect, useRef } from "react";
import { createVinylNoisePlayer } from "../lib/audio/vinylNoise";
import type { VinylNoisePlayer } from "../lib/audio/vinylNoise";

export function useVinylNoise(active: boolean, volumePercent: number): void {
  const playerRef = useRef<VinylNoisePlayer | null>(null);

  useEffect(() => {
    const player = createVinylNoisePlayer();
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  // Volume first, so the fade-in on activation targets the right level.
  useEffect(() => {
    playerRef.current?.setVolume(volumePercent);
  }, [volumePercent]);

  useEffect(() => {
    playerRef.current?.setActive(active);
  }, [active]);
}
