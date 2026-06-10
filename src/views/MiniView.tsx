import { EMPTY_PLAYBACK, selectArtwork, selectIsPlaying, selectPlayback, useVinylDeckStore } from "../lib/playback/store";
import { Controls } from "../components/Controls";
import { TrackInfo } from "../components/TrackInfo";
import { VinylRecord } from "../components/VinylRecord";

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

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "16px",
        background: "var(--bg)",
      }}
    >
      <VinylRecord
        isPlaying={isPlaying}
        vinylWobble={settings.vinylWobble}
        artworkDataUrl={artworkDataUrl}
        trackTitle={effectivePlayback.track}
        size={160}
      />
      <div style={{ width: "100%", transform: "scale(0.78)", transformOrigin: "center" }}>
        <TrackInfo
          track={effectivePlayback.track || "Nothing Playing"}
          artist={effectivePlayback.artist}
          album={effectivePlayback.album}
        />
      </div>
      <div style={{ transform: "scale(0.72)", transformOrigin: "center" }}>
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
