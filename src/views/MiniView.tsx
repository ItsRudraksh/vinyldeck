import { useEffect, useRef, useState } from "react";
import { EMPTY_PLAYBACK, selectArtwork, selectIsPlaying, selectPlayback, useVinylDeckStore } from "../lib/playback/store";
import { Controls } from "../components/Controls";
import { TrackInfo } from "../components/TrackInfo";
import { VinylRecord } from "../components/VinylRecord";
import "./MiniView.css";

const MINI_CONTROLS_HIDE_MS = 1400;

export function MiniView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const source = useVinylDeckStore((s) => s.source);
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const settings = useVinylDeckStore((s) => s.settings);

  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function revealControls() {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), MINI_CONTROLS_HIDE_MS);
  }

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  return (
    <main
      className="mini-view"
      data-tauri-drag-region
      onMouseMove={revealControls}
      onMouseDown={revealControls}
      onTouchStart={revealControls}
    >
      <section className="mini-view__centerpiece" aria-label="Mini player">
        <VinylRecord
          isPlaying={isPlaying}
          vinylWobble={settings.vinylWobble}
          artworkDataUrl={artworkDataUrl}
          trackTitle={effectivePlayback.track}
          size={172}
        />
      </section>

      <div className="mini-view__track">
        <TrackInfo
          track={effectivePlayback.track || "Nothing Playing"}
          artist={effectivePlayback.artist}
          album={effectivePlayback.album}
        />
      </div>

      <div className={`mini-view__controls${controlsVisible ? " mini-view__controls--visible" : ""}`}>
        <Controls
          isPlaying={isPlaying}
          canControl={effectivePlayback.canControl}
          onPlay={() => source?.play()}
          onPause={() => source?.pause()}
          onNext={() => source?.next()}
          onPrevious={() => source?.previous()}
        />
      </div>
    </main>
  );
}
