// src/views/MainView.tsx
// Final z-stack layout for Main and Fullscreen modes.
// Supports Pure Vinyl, Split View (left or right lyrics side), and Compact Strip,
// viewport-responsive Idle turntable scaling, Auto-Romanize for foreign scripts
// (never auto-translating), and a slim essential-only custom context menu.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  EMPTY_PLAYBACK,
  useVinylDeckStore,
  selectPlayback,
  selectIsPlaying,
  selectArtwork,
  selectTheme,
  selectSettings,
  selectTrackChangeDirection,
  selectTrackChangeNonce,
} from "../lib/playback/store";
import {
  canUseSeekControl,
  canUseSkipControls,
  canUseTransportControls,
} from "../lib/playback/capabilities";
import { shouldDisplayLyricsStage } from "../lib/lyrics/parsers";
import type { LyricsLayout } from "../lib/lyrics/types";

import { AmbientLayer } from "../components/AmbientLayer";
import { VinylRecord } from "../components/VinylRecord";
import { NeedleArm } from "../components/NeedleArm";
import { ProgressRing } from "../components/ProgressRing";
import { TrackInfo } from "../components/TrackInfo";
import { Controls } from "../components/Controls";
import { ThemePicker } from "../components/ThemePicker";
import { SourceBadge } from "../components/SourceBadge";
import { Settings } from "../components/Settings";
import { AppContextMenu } from "../components/AppContextMenu";
import { LyricsStage } from "../components/LyricsStage";
import { Kbd } from "../components/Kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { useIdleMode } from "../hooks/useIdleMode";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useLyrics } from "../hooks/useLyrics";
import { quitApplication } from "../lib/appLifecycle";
import { commitSettings } from "../lib/settings";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  resetAmbientColors,
} from "../lib/themes/applier";
import { setNativeWindowMode } from "../lib/window";
import "./MainView.css";

// Fixed base geometry so VinylRecord & NeedleArm never unmount or reset spin angle
const BASE_VINYL_SIZE = 420;
const RING_OFFSET = 28;
const BASE_RING_SIZE = BASE_VINYL_SIZE + RING_OFFSET;

// Shared easing & choreography curves
const STAGE_EASE = [0.16, 1, 0.3, 1] as const;
const IDLE_TRANSITION =
  "opacity 560ms cubic-bezier(0.16, 1, 0.3, 1), pointer-events 0ms";
const IDLE_RETURN_TRANSITION = "opacity 360ms cubic-bezier(0.16, 1, 0.3, 1)";

interface PlaybackProgressRingProps {
  duration: number;
  isPlaying: boolean;
  size: number;
  canSeek: boolean;
  onSeek: (positionSeconds: number) => void;
}

function PlaybackProgressRing({
  duration,
  isPlaying,
  size,
  canSeek,
  onSeek,
}: PlaybackProgressRingProps) {
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

  function handleSeek(positionSeconds: number) {
    setPosition(positionSeconds);
    onSeek(positionSeconds);
  }

  return (
    <ProgressRing
      duration={duration}
      position={position}
      isPlaying={isPlaying}
      size={size}
      onSeek={canSeek ? handleSeek : undefined}
    />
  );
}

function clampScale(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

export function MainView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const theme = useVinylDeckStore(selectTheme);
  const settings = useVinylDeckStore(selectSettings);
  const trackChangeDirection = useVinylDeckStore(selectTrackChangeDirection);
  const trackChangeNonce = useVinylDeckStore(selectTrackChangeNonce);
  const source = useVinylDeckStore((s) => s.source);
  const beginPendingSeek = useVinylDeckStore((s) => s.beginPendingSeek);
  const markTrackChangeIntent = useVinylDeckStore(
    (s) => s.markTrackChangeIntent,
  );
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Per-track manual override when Auto-Romanize is enabled so pressing Rom / R
  // still lets you toggle back to original script on the current song.
  const [trackRomOverride, setTrackRomOverride] = useState<{
    trackKey: string;
    value: boolean;
  } | null>(null);

  // Track viewport size for commanding, clip-free Idle turntable scaling
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  }));

  useEffect(() => {
    function handleResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;

  const hasTrack = Boolean(effectivePlayback.track.trim());
  const lyricsLayout: LyricsLayout = settings.lyricsLayout;

  // Auto-Romanize activates romanization automatically on foreign-script tracks
  // without ever auto-translating (lyricsTranslated remains strictly manual).
  const currentTrackIdentity = `${effectivePlayback.artist}::${effectivePlayback.track}`;
  const effectiveShowRomanized =
    trackRomOverride && trackRomOverride.trackKey === currentTrackIdentity
      ? trackRomOverride.value
      : settings.lyricsAutoRomanize || settings.lyricsRomanized;

  const lyrics = useLyrics(
    {
      track: effectivePlayback.track,
      artist: effectivePlayback.artist,
      album: effectivePlayback.album,
      duration: effectivePlayback.duration,
      sourceName: effectivePlayback.sourceName,
    },
    {
      enabled: settings.lyricsEnabled && hasTrack,
      romanized: effectiveShowRomanized,
      translated: settings.lyricsTranslated,
      targetLang: settings.lyricsTargetLang,
    },
  );

  // Clear per-track romanization override when track changes
  useEffect(() => {
    setTrackRomOverride(null);
  }, [currentTrackIdentity]);

  const effectiveShowLyrics = shouldDisplayLyricsStage(
    settings.lyricsEnabled,
    hasTrack,
    lyrics.status,
    lyrics.document,
  );

  const isAutoHiddenInstrumental =
    settings.lyricsEnabled &&
    hasTrack &&
    lyrics.status === "ready" &&
    lyrics.document?.kind === "instrumental";

  const isAutoHiddenNotFound =
    settings.lyricsEnabled &&
    hasTrack &&
    lyrics.status === "ready" &&
    lyrics.document?.kind === "not_found";

  useKeyboardShortcuts({
    renderMode: "main",
    isSettingsOpen,
    onCloseSettings: () => setIsSettingsOpen(false),
    onOpenSettings: () => setIsSettingsOpen(true),
    onToggleRomanized: handleToggleRomanized,
  });

  useColorExtraction(artworkDataUrl, {
    ambientEnabled: settings.ambientMode !== "off",
    seed: `${effectivePlayback.album || effectivePlayback.track || "Unknown Album"}|${effectivePlayback.artist || "Unknown Artist"}`,
  });

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

  function handlePlay() {
    source?.play();
  }
  function handlePause() {
    source?.pause();
  }
  function handleNext() {
    markTrackChangeIntent("next");
    source?.next();
  }
  function handlePrevious() {
    markTrackChangeIntent("previous");
    source?.previous();
  }

  function handleSeek(positionSeconds: number) {
    beginPendingSeek(positionSeconds);
    source?.seekTo(positionSeconds);
  }

  function applyCommittedSettings(nextSettings: typeof settings) {
    useVinylDeckStore.getState().hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
  }

  function handleWindowModeSelect(mode: "main" | "fullscreen" | "mini") {
    void commitSettings({ windowMode: mode })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeWindowMode(mode);
      })
      .catch((error) => {
        console.warn("[ContextMenu] Window mode failed:", error);
      });
  }

  function handleArtAmbientToggle() {
    const nextMode = settings.ambientMode === "off" ? ART_AMBIENT_MODE : "off";
    if (nextMode === "off") resetAmbientColors();
    void commitSettings({
      ambientMode: nextMode,
      artAmbient: nextMode !== "off",
    })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[ContextMenu] Art Ambient failed:", error);
      });
  }

  function handleLyricsTriggerClick() {
    if (isAutoHiddenNotFound) {
      lyrics.retry();
      return;
    }
    handleLyricsToggle();
  }

  function handleLyricsToggle() {
    void commitSettings({ lyricsEnabled: !settings.lyricsEnabled })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Lyrics] Toggle failed:", error);
      });
  }

  function handleLyricsLayoutChange(nextLayout: LyricsLayout) {
    void commitSettings({ lyricsEnabled: true, lyricsLayout: nextLayout })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Lyrics] Layout change failed:", error);
      });
  }

  function handleToggleRomanized() {
    if (settings.lyricsAutoRomanize) {
      setTrackRomOverride({
        trackKey: currentTrackIdentity,
        value: !effectiveShowRomanized,
      });
      return;
    }
    void commitSettings({ lyricsRomanized: !settings.lyricsRomanized })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Lyrics] Romanized toggle failed:", error);
      });
  }

  function handleToggleTranslated() {
    void commitSettings({ lyricsTranslated: !settings.lyricsTranslated })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Lyrics] Translated toggle failed:", error);
      });
  }

  const contextMenuActions = useMemo(
    () => [
      {
        id: "play-pause",
        label: isPlaying ? "Pause" : "Play",
        kbd: "Space",
        disabled: !canUseTransportControls(effectivePlayback),
        onSelect: isPlaying ? handlePause : handlePlay,
      },
      {
        id: "previous",
        label: "Previous",
        kbd: "Left",
        disabled: !canUseSkipControls(effectivePlayback),
        onSelect: handlePrevious,
      },
      {
        id: "next",
        label: "Next",
        kbd: "Right",
        disabled: !canUseSkipControls(effectivePlayback),
        onSelect: handleNext,
      },
      {
        id: "lyrics-toggle",
        label: settings.lyricsEnabled ? "Hide Lyrics" : "Show Lyrics",
        kbd: "L",
        onSelect: handleLyricsToggle,
      },
      {
        id: "art-ambient",
        label:
          settings.ambientMode === "off" ? "Art Ambient On" : "Art Ambient Off",
        kbd: "A",
        onSelect: handleArtAmbientToggle,
      },
      {
        id: "fullscreen",
        label:
          settings.windowMode === "fullscreen" ? "Exit Fullscreen" : "Fullscreen",
        kbd: "F",
        onSelect: () =>
          handleWindowModeSelect(
            settings.windowMode === "fullscreen" ? "main" : "fullscreen",
          ),
      },
      {
        id: "mini",
        label: "Mini Player",
        kbd: "M",
        onSelect: () => handleWindowModeSelect("mini"),
      },
      {
        id: "settings",
        label: "Settings",
        kbd: "S",
        onSelect: () => setIsSettingsOpen(true),
      },
      {
        id: "quit",
        label: "Quit",
        kbd: "Ctrl Q",
        destructive: true,
        onSelect: () => {
          void quitApplication().catch((error) => {
            console.warn("[ContextMenu] Quit failed:", error);
          });
        },
      },
    ],
    [
      effectivePlayback,
      isPlaying,
      settings.ambientMode,
      settings.lyricsEnabled,
      settings.windowMode,
    ],
  );

  // Viewport-responsive GPU turntable scale across all 6 states (Pure/Split/Strip × Active/Idle)
  // Scales generously in Idle/Fullscreen while guaranteeing zero viewport clipping.
  const vinylScale = useMemo(() => {
    const vh = viewport.height;
    const vw = viewport.width;
    if (!effectiveShowLyrics) {
      if (isIdle) {
        const fit = Math.min((vh * 0.72) / BASE_RING_SIZE, (vw * 0.72) / BASE_RING_SIZE);
        return clampScale(fit, 1.05, 1.56);
      }
      const fit = Math.min((vh * 0.56) / BASE_RING_SIZE, (vw * 0.62) / BASE_RING_SIZE);
      return clampScale(fit, 0.82, 1.06);
    }

    if (lyricsLayout === "split") {
      if (isIdle) {
        const fit = Math.min((vh * 0.64) / BASE_RING_SIZE, (vw * 0.42) / BASE_RING_SIZE);
        return clampScale(fit, 0.96, 1.34);
      }
      const fit = Math.min((vh * 0.52) / BASE_RING_SIZE, (vw * 0.38) / BASE_RING_SIZE);
      return clampScale(fit, 0.78, 0.94);
    }

    // Compact Strip
    if (isIdle) {
      const fit = Math.min((vh * 0.56) / BASE_RING_SIZE, (vw * 0.62) / BASE_RING_SIZE);
      return clampScale(fit, 0.96, 1.24);
    }
    const fit = Math.min((vh * 0.44) / BASE_RING_SIZE, (vw * 0.54) / BASE_RING_SIZE);
    return clampScale(fit, 0.68, 0.8);
  }, [effectiveShowLyrics, isIdle, lyricsLayout, viewport.height, viewport.width]);

  const vinylSlotSize = Math.round(BASE_RING_SIZE * vinylScale);

  const idleFadeStyle = {
    opacity: isIdle ? 0 : 1,
    pointerEvents: isIdle ? ("none" as const) : ("auto" as const),
    transition: isIdle ? IDLE_TRANSITION : IDLE_RETURN_TRANSITION,
  };

  const cornerChromeClass = `main-chrome-corner${isIdle ? " main-chrome-corner--idle" : ""}`;

  const stageClass = [
    "main-stage",
    effectiveShowLyrics ? `main-stage--${lyricsLayout}` : "main-stage--pure",
    effectiveShowLyrics && lyricsLayout === "split" && settings.lyricsSide === "left"
      ? "main-stage--split-left"
      : "",
    isIdle ? "main-stage--idle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const lyricsStageNode = (
    <LyricsStage
      layout={lyricsLayout}
      fontFamily={settings.lyricsFontFamily}
      fontSize={settings.lyricsFontSize}
      status={lyrics.status}
      document={lyrics.document}
      isPlaying={isPlaying}
      isIdle={isIdle}
      canSeek={canUseSeekControl(effectivePlayback)}
      duration={effectivePlayback.duration}
      showRomanized={effectiveShowRomanized}
      showTranslated={settings.lyricsTranslated}
      targetLang={settings.lyricsTargetLang}
      hasNonLatin={lyrics.hasNonLatin}
      isSameAsTargetLang={lyrics.isSameAsTargetLang}
      isEnriching={lyrics.isEnriching}
      enrichmentNonce={lyrics.enrichmentNonce}
      onSeek={handleSeek}
      onLayoutChange={handleLyricsLayoutChange}
      onToggleRomanized={handleToggleRomanized}
      onToggleTranslated={handleToggleTranslated}
      onRetry={lyrics.retry}
    />
  );

  const lyricsTriggerTooltip = isAutoHiddenInstrumental ? (
    <>
      Instrumental · Lyrics auto-hidden <Kbd>L</Kbd>
    </>
  ) : isAutoHiddenNotFound ? (
    <>No lyrics found · Click to retry</>
  ) : (
    <>
      {settings.lyricsEnabled ? "Hide lyrics" : "Show lyrics"} <Kbd>L</Kbd>
    </>
  );

  return (
    <>
      {/* z:0 — Ambient background */}
      <AmbientLayer
        filmGrain={settings.filmGrain}
        mode={settings.ambientMode}
        theme={theme}
      />

      {/* z:0 — Vapor grid floor */}

      {/* z:1 — Unified choreographed stage */}
      <main
        className={stageClass}
        data-lyrics-mode={effectiveShowLyrics ? lyricsLayout : "off"}
        data-lyrics-side={settings.lyricsSide}
        data-idle={isIdle ? "true" : "false"}
      >
        <motion.div
          layout
          transition={{ duration: 0.54, ease: STAGE_EASE }}
          className="main-stage__deck"
        >
          {/* Vinyl unit — layout box & GPU scale animate smoothly; spin never resets */}
          <Tooltip maxVisibleMs={1800}>
            <TooltipTrigger>
              <motion.div
                className="main-stage__vinyl-slot"
                animate={{
                  width: vinylSlotSize,
                  height: vinylSlotSize,
                }}
                transition={{ duration: 0.56, ease: STAGE_EASE }}
              >
                <motion.div
                  className="main-stage__vinyl-inner"
                  style={{
                    width: `${BASE_RING_SIZE}px`,
                    height: `${BASE_RING_SIZE}px`,
                  }}
                  animate={{ scale: vinylScale }}
                  transition={{ duration: 0.56, ease: STAGE_EASE }}
                >
                  {/* Progress ring — fades cleanly on Lean-Back idle */}
                  <div style={idleFadeStyle}>
                    <PlaybackProgressRing
                      duration={effectivePlayback.duration}
                      isPlaying={isPlaying}
                      size={BASE_RING_SIZE}
                      canSeek={canUseSeekControl(effectivePlayback)}
                      onSeek={handleSeek}
                    />
                  </div>

                  {/* Vinyl record */}
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <VinylRecord
                      isPlaying={isPlaying}
                      vinylWobble={settings.vinylWobble}
                      artworkDataUrl={artworkDataUrl}
                      trackTitle={effectivePlayback.track}
                      size={BASE_VINYL_SIZE}
                      trackChangeDirection={trackChangeDirection}
                      trackChangeNonce={trackChangeNonce}
                    />
                  </div>

                  {/* Needle arm */}
                  <NeedleArm
                    isPlaying={isPlaying}
                    trackKey={effectivePlayback.track}
                  />
                </motion.div>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>Drag to seek</TooltipContent>
          </Tooltip>

          {/* Compact Strip slot — glides smoothly in/out beneath the vinyl */}
          <AnimatePresence initial={false}>
            {effectiveShowLyrics && lyricsLayout === "strip" && (
              <motion.div
                key="strip-lyrics"
                className="main-stage__lyrics main-stage__lyrics--strip"
                initial={{ opacity: 0, height: 0, y: 8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: 8 }}
                transition={{ duration: 0.48, ease: STAGE_EASE }}
              >
                {lyricsStageNode}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible transport chrome dock */}
          <motion.div
            className="main-stage__chrome-dock"
            initial={false}
            animate={{
              height: isIdle ? 0 : "auto",
              opacity: isIdle ? 0 : 1,
            }}
            transition={{ duration: 0.54, ease: STAGE_EASE }}
            style={{ pointerEvents: isIdle ? "none" : "auto" }}
            aria-hidden={isIdle}
          >
            <div className="main-stage__chrome-inner">
              <TrackInfo
                track={effectivePlayback.track || "Nothing Playing"}
                artist={effectivePlayback.artist}
                album={effectivePlayback.album}
                direction={trackChangeDirection}
              />
              <Controls
                isPlaying={isPlaying}
                canControl={effectivePlayback.canControl}
                canSkip={effectivePlayback.canSkip}
                onPlay={handlePlay}
                onPause={handlePause}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
              <ThemePicker />
            </div>
          </motion.div>
        </motion.div>

        {/* Split View lyrics column — glides smoothly in/out beside the vinyl */}
        <AnimatePresence initial={false}>
          {effectiveShowLyrics && lyricsLayout === "split" && (
            <motion.div
              key="split-lyrics"
              className="main-stage__lyrics main-stage__lyrics--split"
              initial={{ opacity: 0, x: settings.lyricsSide === "left" ? -14 : 14, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: settings.lyricsSide === "left" ? -14 : 14, scale: 0.985 }}
              transition={{ duration: 0.52, ease: STAGE_EASE }}
            >
              {lyricsStageNode}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* z:2 — Source badge */}
      <div className={cornerChromeClass} aria-hidden={isIdle}>
        <SourceBadge sourceName={effectivePlayback.sourceName} />
      </div>

      <AppContextMenu actions={contextMenuActions} />

      {/* z:90 — Lyrics & Settings triggers */}
      <div className={cornerChromeClass} aria-hidden={isIdle}>
        <Tooltip side="bottom">
          <TooltipTrigger>
            <button
              type="button"
              className={[
                "lyrics-trigger",
                settings.lyricsEnabled && !isAutoHiddenInstrumental && !isAutoHiddenNotFound
                  ? "lyrics-trigger--active"
                  : "",
                isAutoHiddenInstrumental || isAutoHiddenNotFound
                  ? "lyrics-trigger--muted"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                isAutoHiddenInstrumental
                  ? "Instrumental track, lyrics auto-hidden"
                  : isAutoHiddenNotFound
                    ? "No lyrics found, click to retry"
                    : settings.lyricsEnabled
                      ? "Hide lyrics"
                      : "Show lyrics"
              }
              aria-pressed={settings.lyricsEnabled}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleLyricsTriggerClick();
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 7h11"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                />
                <path
                  d="M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                />
                <path
                  d="M5 17h8"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="16.5"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="1.55"
                />
                <path
                  d="M20 16.5V10.5"
                  stroke="currentColor"
                  strokeWidth="1.55"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>{lyricsTriggerTooltip}</TooltipContent>
        </Tooltip>

        <Tooltip side="bottom">
          <TooltipTrigger>
            <button
              type="button"
              className="settings-trigger"
              aria-label="Open settings"
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsSettingsOpen(true);
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
          </TooltipTrigger>
          <TooltipContent>
            Settings <Kbd>S</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <Settings
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
