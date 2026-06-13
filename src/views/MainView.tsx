// src/views/MainView.tsx
// Final z-stack layout for Stage 2.
// Hierarchy:
//   z:0  AmbientLayer (fixed, behind all)
//   z:0  VaporGrid (fixed, Vapor theme only)
//   z:1  Content container (flex column, centered)
//         vinyl-area (relative) → ProgressRing + VinylRecord + NeedleArm
//         TrackInfo    ← fades on idle
//         Controls     ← fades on idle
//         ThemePicker  ← fades on idle
//   z:2  SourceBadge (fixed, bottom-right)
//
// Phase 7: useIdleMode — 3s inactivity → TrackInfo/Controls/ThemePicker fade out
// Phase 8: ProgressRing receives onSeek for scrub-to-seek

import { useEffect, useState } from "react";
import {
  EMPTY_PLAYBACK,
  useVinylDeckStore,
  selectPlayback,
  selectIsPlaying,
  selectArtwork,
  selectTheme,
  selectSettings,
} from "../lib/playback/store";
import { canUseSeekControl } from "../lib/playback/capabilities";

import { AmbientLayer } from "../components/AmbientLayer";
import { VaporGrid } from "../components/VaporGrid";
import { VinylRecord } from "../components/VinylRecord";
import { NeedleArm } from "../components/NeedleArm";
import { ProgressRing } from "../components/ProgressRing";
import { TrackInfo } from "../components/TrackInfo";
import { Controls } from "../components/Controls";
import { ThemePicker } from "../components/ThemePicker";
import { SourceBadge } from "../components/SourceBadge";
import { Settings } from "../components/Settings";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { useIdleMode } from "../hooks/useIdleMode";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

const VINYL_SIZE = 420;
const RING_SIZE = VINYL_SIZE + 28;

// Shared transition for idle fade in/out
const IDLE_TRANSITION =
  "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), pointer-events 0ms";
const IDLE_RETURN_TRANSITION = "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)";
const IDLE_CENTERPIECE_TRANSITION =
  "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)";

export function MainView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const theme = useVinylDeckStore(selectTheme);
  const settings = useVinylDeckStore(selectSettings);
  const artAmbient = useVinylDeckStore((s) => s.artAmbient);
  const source = useVinylDeckStore((s) => s.source);
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;

  useKeyboardShortcuts({
    renderMode: "main",
    isSettingsOpen,
    onCloseSettings: () => setIsSettingsOpen(false),
  });

  // Client-side extrapolated position (updated every 500ms)
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPosition(
        useVinylDeckStore.getState().devForceEmpty
          ? 0
          : useVinylDeckStore.getState().getPosition(),
      );
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (devForceEmpty) setPosition(0);
  }, [devForceEmpty]);

  // Album art extraction now drives the vinyl pressing on every theme.
  // Ambient tinting remains Noir-only and gated by the existing user toggle.
  useColorExtraction(artworkDataUrl, {
    ambientEnabled: theme === "noir" && artAmbient,
    seed: `${effectivePlayback.album || effectivePlayback.track || "Unknown Album"}|${effectivePlayback.artist || "Unknown Artist"}`,
  });

  // Phase 7: Idle detection — only when playing
  const isIdle = useIdleMode(isPlaying, {
    enabled: settings.leanBackMode,
    hideCursor: settings.cursorHide,
    timeoutMs: settings.idleTimeoutSeconds * 1000,
  });

  useEffect(() => {
    if (!isSettingsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSettingsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen]);

  // Controls handlers — delegate to source
  function handlePlay() {
    source?.play();
  }
  function handlePause() {
    source?.pause();
  }
  function handleNext() {
    source?.next();
  }
  function handlePrevious() {
    source?.previous();
  }

  // Phase 8: Seek handler — delegates to source
  function handleSeek(positionSeconds: number) {
    source?.seekTo(positionSeconds);
  }

  // Idle UI style — shared across Controls / TrackInfo / ThemePicker
  const idleHideStyle = {
    opacity: isIdle ? 0 : 1,
    pointerEvents: isIdle ? ("none" as const) : ("auto" as const),
    transition: isIdle ? IDLE_TRANSITION : IDLE_RETURN_TRANSITION,
  };

  const idleVinylAreaStyle = {
    transform: isIdle
      ? "translate3d(0, clamp(72px, 8.8vh, 96px), 0) scale(1.22)"
      : "translate3d(0, 0, 0) scale(1)",
    transformOrigin: "center center",
    transition: IDLE_CENTERPIECE_TRANSITION,
    willChange: isPlaying ? ("transform" as const) : undefined,
  };

  return (
    <>
      {/* z:0 — Ambient background */}
      <AmbientLayer filmGrain={settings.filmGrain} />

      {/* z:0 — Vapor grid floor */}
      <VaporGrid />

      {/* z:1 — Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "28px",
          padding: "40px 24px",
        }}
      >
        {/* Vinyl area */}
        <div
          style={{
            position: "relative",
            width: `${RING_SIZE}px`,
            height: `${RING_SIZE}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            ...idleVinylAreaStyle,
          }}
        >
          {/* Progress ring — Phase 8: receives onSeek */}
          {/* Phase 7: ring fades with rest of UI on idle */}
          <div style={idleHideStyle}>
            <ProgressRing
              duration={effectivePlayback.duration}
              position={position}
              isPlaying={isPlaying}
              size={RING_SIZE}
              onSeek={
                canUseSeekControl(effectivePlayback) ? handleSeek : undefined
              }
            />
          </div>

          {/* Vinyl record */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <VinylRecord
              isPlaying={isPlaying}
              vinylWobble={settings.vinylWobble}
              artworkDataUrl={artworkDataUrl}
              trackTitle={effectivePlayback.track}
              size={VINYL_SIZE}
            />
          </div>

          {/* Needle arm */}
          <NeedleArm isPlaying={isPlaying} trackKey={effectivePlayback.track} />
        </div>

        {/* Track info — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <TrackInfo
            track={effectivePlayback.track || "Nothing Playing"}
            artist={effectivePlayback.artist}
            album={effectivePlayback.album}
          />
        </div>

        {/* Controls — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <Controls
            isPlaying={isPlaying}
            canControl={effectivePlayback.canControl}
            canSkip={effectivePlayback.canSkip}
            onPlay={handlePlay}
            onPause={handlePause}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        </div>

        {/* Theme picker — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <ThemePicker />
        </div>
      </div>

      {/* z:2 — Source badge */}
      <SourceBadge sourceName={effectivePlayback.sourceName} />

      {/* z:3 — Settings trigger */}
      <button
        type="button"
        aria-label="Open settings"
        onClick={() => setIsSettingsOpen(true)}
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 3,
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          color: "var(--ui-text-primary)",
          background: "var(--ui-bg)",
          border: "1px solid var(--ui-border)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          backdropFilter: "blur(20px) saturate(1.4)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 28px rgba(0,0,0,0.28)",
          transition:
            "transform 180ms var(--spring-curve), background var(--theme-transition), border-color var(--theme-transition)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4.5 7.25h5.25"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M13.75 7.25h5.75"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M4.5 12h9.25"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M17.75 12h1.75"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M4.5 16.75h2.75"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <path
            d="M11.25 16.75h8.25"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <circle
            cx="11.75"
            cy="7.25"
            r="2"
            stroke="currentColor"
            strokeWidth="1.55"
          />
          <circle
            cx="15.75"
            cy="12"
            r="2"
            stroke="currentColor"
            strokeWidth="1.55"
          />
          <circle
            cx="9.25"
            cy="16.75"
            r="2"
            stroke="currentColor"
            strokeWidth="1.55"
          />
        </svg>
      </button>

      {/* z:40 — Settings overlay */}
      <Settings
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
