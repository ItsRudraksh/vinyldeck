import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { AmbientLayer } from "../components/AmbientLayer";
import { AppContextMenu } from "../components/AppContextMenu";
import { Controls } from "../components/Controls";
import { TrackInfo } from "../components/TrackInfo";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { VinylRecord } from "../components/VinylRecord";
import { VaporGrid } from "../components/VaporGrid";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { quitApplication } from "../lib/appLifecycle";
import { canUseSkipControls, canUseTransportControls } from "../lib/playback/capabilities";
import { commitSettings } from "../lib/settings";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  resetAmbientColors,
} from "../lib/themes/applier";
import { setNativeWindowMode } from "../lib/window";
import {
  EMPTY_PLAYBACK,
  selectArtwork,
  selectIsPlaying,
  selectPlayback,
  selectTheme,
  selectTrackChangeDirection,
  selectTrackChangeNonce,
  useVinylDeckStore,
} from "../lib/playback/store";
import "./MiniView.css";

const MINI_CONTROLS_HIDE_MS = 1400;
const MINI_SNAP_THRESHOLD_PX = 28;
const MINI_SNAP_MARGIN_PX = 8;
const MINI_SNAP_SETTLE_MS = 180;

export function MiniView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const theme = useVinylDeckStore(selectTheme);
  const trackChangeDirection = useVinylDeckStore(selectTrackChangeDirection);
  const trackChangeNonce = useVinylDeckStore(selectTrackChangeNonce);
  const source = useVinylDeckStore((s) => s.source);
  const markTrackChangeIntent = useVinylDeckStore(
    (s) => s.markTrackChangeIntent,
  );
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const settings = useVinylDeckStore((s) => s.settings);

  useKeyboardShortcuts({ renderMode: "mini" });

  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function revealControls() {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      MINI_CONTROLS_HIDE_MS,
    );
  }

  function handleMouseDown(event: MouseEvent<HTMLElement>) {
    revealControls();
    if (event.button !== 0 || !isTauri()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, .mini-view__controls, .mini-view__return"))
      return;

    void getCurrentWindow()
      .startDragging()
      .catch((error) => {
        console.warn("[Window] Mini drag failed:", error);
      });
  }

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  useColorExtraction(artworkDataUrl, {
    ambientEnabled: settings.ambientMode !== "off",
    seed: `${effectivePlayback.album || effectivePlayback.track || "Unknown Album"}|${effectivePlayback.artist || "Unknown Artist"}`,
  });
  useMiniCornerSnap();

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

  function applyCommittedSettings(nextSettings: typeof settings) {
    useVinylDeckStore.getState().hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
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
        id: "art-ambient",
        label:
          settings.ambientMode === "off" ? "Art Ambient On" : "Art Ambient Off",
        kbd: "A",
        onSelect: handleArtAmbientToggle,
      },
      {
        id: "main",
        label: "Main Window",
        kbd: "M",
        onSelect: () => {
          void setNativeWindowMode("main");
        },
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
    [effectivePlayback, isPlaying, settings.ambientMode],
  );

  return (
    <main
      className="mini-view"
      onMouseMove={revealControls}
      onMouseDown={handleMouseDown}
      onTouchStart={revealControls}
    >
      <AmbientLayer
        filmGrain={settings.filmGrain}
        mode={settings.ambientMode}
        theme={theme}
      />
      <VaporGrid />

      <section className="mini-view__centerpiece" aria-label="Mini player">
        <Tooltip maxVisibleMs={1800}>
          <TooltipTrigger>
            <VinylRecord
              isPlaying={isPlaying}
              vinylWobble={settings.vinylWobble}
              artworkDataUrl={artworkDataUrl}
              trackTitle={effectivePlayback.track}
              size={172}
              trackChangeDirection={trackChangeDirection}
              trackChangeNonce={trackChangeNonce}
            />
          </TooltipTrigger>
          <TooltipContent>Drag to seek</TooltipContent>
        </Tooltip>
      </section>

      <div className="mini-view__track">
        <TrackInfo
          track={effectivePlayback.track || "Nothing Playing"}
          artist={effectivePlayback.artist}
          album={effectivePlayback.album}
          direction={trackChangeDirection}
        />
      </div>

      <div
        className={`mini-view__controls${controlsVisible ? " mini-view__controls--visible" : ""}`}
      >
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

      <AppContextMenu actions={contextMenuActions} />

      <button
        className={`mini-view__return${controlsVisible ? " mini-view__return--visible" : ""}`}
        type="button"
        aria-label="Return to main window"
        title="Return to main window"
        onClick={(event) => {
          event.stopPropagation();
          void setNativeWindowMode("main");
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 4H4v4M4 4l6.5 6.5M16 20h4v-4M20 20l-6.5-6.5M20 8V4h-4M20 4l-6.5 6.5M4 16v4h4M4 20l6.5-6.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </main>
  );
}

function useMiniCornerSnap() {
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snappingRef = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    const appWindow = getCurrentWindow();
    if (appWindow.label !== "mini") return;

    let unlisten: (() => void) | undefined;

    async function installMovedListener() {
      unlisten = await appWindow.onMoved(() => {
        if (snappingRef.current) return;
        if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
        snapTimerRef.current = setTimeout(() => {
          void snapNearCorner();
        }, MINI_SNAP_SETTLE_MS);
      });
    }

    async function snapNearCorner() {
      const monitor = await currentMonitor();
      if (!monitor) return;

      const position = await appWindow.outerPosition();
      const size = await appWindow.outerSize();
      const area = monitor.workArea;
      const left = area.position.x + MINI_SNAP_MARGIN_PX;
      const top = area.position.y + MINI_SNAP_MARGIN_PX;
      const right =
        area.position.x + area.size.width - size.width - MINI_SNAP_MARGIN_PX;
      const bottom =
        area.position.y + area.size.height - size.height - MINI_SNAP_MARGIN_PX;
      const snapX =
        Math.abs(position.x - left) <= MINI_SNAP_THRESHOLD_PX
          ? left
          : Math.abs(position.x - right) <= MINI_SNAP_THRESHOLD_PX
            ? right
            : null;
      const snapY =
        Math.abs(position.y - top) <= MINI_SNAP_THRESHOLD_PX
          ? top
          : Math.abs(position.y - bottom) <= MINI_SNAP_THRESHOLD_PX
            ? bottom
            : null;

      if (snapX === null || snapY === null) return;

      snappingRef.current = true;
      try {
        await appWindow.setPosition(new PhysicalPosition(snapX, snapY));
      } finally {
        window.setTimeout(() => {
          snappingRef.current = false;
        }, MINI_SNAP_SETTLE_MS);
      }
    }

    void installMovedListener();

    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      unlisten?.();
    };
  }, []);
}
