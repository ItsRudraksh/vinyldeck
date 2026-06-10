import { EMPTY_PLAYBACK, selectArtwork, selectIsPlaying, selectPlayback, useVinylDeckStore } from "../lib/playback/store";
import { AmbientLayer } from "../components/AmbientLayer";
import { Controls } from "../components/Controls";
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
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "24px 14px 12px",
        color: "var(--ui-text-primary, rgba(255,255,255,0.9))",
        background: "var(--bg, #000000)",
      }}
    >
      <AmbientLayer filmGrain={settings.filmGrain} />
      <div
        data-tauri-drag-region
        aria-label="Drag mini player"
        style={{
          position: "absolute",
          inset: "0 0 auto",
          height: "28px",
          zIndex: 20,
          cursor: "move",
        }}
      />
      <section
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateRows: "142px minmax(0, 1fr) 46px",
          alignItems: "center",
          justifyItems: "center",
          gap: "6px",
        }}
      >
      <VinylRecord
        isPlaying={isPlaying}
        vinylWobble={settings.vinylWobble}
        artworkDataUrl={artworkDataUrl}
        trackTitle={effectivePlayback.track}
        size={136}
      />
      <div
        style={{
          width: "100%",
          minWidth: 0,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <h2
          title={effectivePlayback.track || "Nothing Playing"}
          style={{
            fontFamily: "var(--font-display, 'Sora'), system-ui, sans-serif",
            fontSize: "14px",
            lineHeight: 1.1,
            color: "var(--ui-text-primary, rgba(255,255,255,0.9))",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {effectivePlayback.track || "Nothing Playing"}
        </h2>
        <p
          title={effectivePlayback.artist}
          style={{
            marginTop: "5px",
            fontFamily: "var(--font-mono, 'JetBrains Mono'), monospace",
            fontSize: "9px",
            lineHeight: 1,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ui-text-secondary, rgba(255,255,255,0.48))",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {effectivePlayback.artist || "—"}
        </p>
      </div>
      <div style={{ transform: "scale(0.62)", transformOrigin: "center" }}>
        <Controls
          isPlaying={isPlaying}
          canControl={effectivePlayback.canControl}
          onPlay={() => source?.play()}
          onPause={() => source?.pause()}
          onNext={() => source?.next()}
          onPrevious={() => source?.previous()}
        />
      </div>
      </section>
    </main>
  );
}
