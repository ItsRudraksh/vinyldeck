import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { commitSettings } from "../lib/settings";
import { ART_AMBIENT_MODE, applyVisualMode, resetAmbientColors } from "../lib/themes/applier";
import type { ThemeId } from "../lib/themes/applier";
import { quitApplication } from "../lib/appLifecycle";
import { canUseSkipControls, canUseTransportControls } from "../lib/playback/capabilities";
import { useVinylDeckStore } from "../lib/playback/store";
import { setNativeWindowMode } from "../lib/window";
import type { RenderWindowMode, WindowMode } from "../lib/window/types";

const THEMES: ThemeId[] = ["noir", "glass"];

interface KeyboardShortcutOptions {
  renderMode: RenderWindowMode;
  isSettingsOpen?: boolean;
  onCloseSettings?: () => void;
  onOpenSettings?: () => void;
  onToggleRomanized?: () => void;
}

export function useKeyboardShortcuts({
  renderMode,
  isSettingsOpen = false,
  onCloseSettings,
  onOpenSettings,
  onToggleRomanized,
}: KeyboardShortcutOptions) {
  const optionsRef = useRef({
    renderMode,
    isSettingsOpen,
    onCloseSettings,
    onOpenSettings,
    onToggleRomanized,
  });

  useEffect(() => {
    optionsRef.current = {
      renderMode,
      isSettingsOpen,
      onCloseSettings,
      onOpenSettings,
      onToggleRomanized,
    };
  }, [renderMode, isSettingsOpen, onCloseSettings, onOpenSettings, onToggleRomanized]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event)) return;

      const { playback, settings, source } = useVinylDeckStore.getState();

      if (!settings.keyboardShortcutsEnabled) {
        if (event.code === "Escape") handleEscape(event, optionsRef);
        return;
      }

      if (event.ctrlKey && event.code === "KeyQ") {
        event.preventDefault();
        void quitApplication().catch((error) => {
          console.warn("[Shortcuts] Quit failed:", error);
        });
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (canUseTransportControls(playback)) source?.togglePlayPause();
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (canUseSkipControls(playback)) {
            useVinylDeckStore
              .getState()
              .markTrackChangeIntent("previous");
            source?.previous();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (canUseSkipControls(playback)) {
            useVinylDeckStore.getState().markTrackChangeIntent("next");
            source?.next();
          }
          break;
        case "KeyF":
          event.preventDefault();
          void switchWindowMode(nextFullscreenMode()).catch(logShortcutError);
          break;
        case "KeyM":
          event.preventDefault();
          void switchWindowMode(
            optionsRef.current.renderMode === "mini" ? "main" : "mini",
          ).catch(logShortcutError);
          break;
        case "KeyT":
          event.preventDefault();
          if (event.shiftKey) {
            if (optionsRef.current.renderMode === "main") {
              void toggleLyricsTranslated().catch(logShortcutError);
            }
          } else {
            void cycleTheme().catch(logShortcutError);
          }
          break;
        case "KeyR":
          if (optionsRef.current.renderMode === "main" && !event.shiftKey) {
            event.preventDefault();
            if (optionsRef.current.onToggleRomanized) {
              optionsRef.current.onToggleRomanized();
            } else {
              void toggleLyricsRomanized().catch(logShortcutError);
            }
          }
          break;
        case "KeyA":
          event.preventDefault();
          void toggleArtAmbient().catch(logShortcutError);
          break;
        case "KeyL":
          if (optionsRef.current.renderMode === "main") {
            event.preventDefault();
            if (event.shiftKey) {
              void toggleLyricsLayout().catch(logShortcutError);
            } else {
              void toggleLyricsEnabled().catch(logShortcutError);
            }
          }
          break;
        case "KeyS":
          event.preventDefault();
          optionsRef.current.onOpenSettings?.();
          break;
        case "Escape":
          handleEscape(event, optionsRef);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.altKey || event.metaKey) return true;

  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;

  const editable = target.closest("[contenteditable]");
  if (editable instanceof HTMLElement && editable.isContentEditable) return true;

  if (
    (event.code === "Space" || event.code === "Enter") &&
    target.closest('button, [role="button"], [role="radio"], [role="switch"], [role="option"]')
  ) {
    return true;
  }

  return false;
}

function handleEscape(
  event: KeyboardEvent,
  optionsRef: RefObject<KeyboardShortcutOptions>,
) {
  const { isSettingsOpen, onCloseSettings } = optionsRef.current;
  if (isSettingsOpen) {
    event.preventDefault();
    onCloseSettings?.();
    return;
  }

  if (useVinylDeckStore.getState().settings.windowMode === "fullscreen") {
    event.preventDefault();
    void switchWindowMode("main").catch(logShortcutError);
  }
}

function nextFullscreenMode(): WindowMode {
  return useVinylDeckStore.getState().settings.windowMode === "fullscreen"
    ? "main"
    : "fullscreen";
}

async function switchWindowMode(mode: WindowMode) {
  const settings = await commitSettings({ windowMode: mode });
  useVinylDeckStore.getState().hydrateSettings(settings);
  await setNativeWindowMode(mode);
}

async function cycleTheme() {
  const currentTheme = useVinylDeckStore.getState().theme;
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  const settings = await commitSettings({ theme: nextTheme });

  useVinylDeckStore.getState().hydrateSettings(settings);
  applyVisualMode(settings.theme, settings.ambientMode);
  if (settings.ambientMode === "off") resetAmbientColors();
}

async function toggleArtAmbient() {
  const currentMode = useVinylDeckStore.getState().ambientMode;
  const nextMode = currentMode === "off" ? ART_AMBIENT_MODE : "off";
  const settings = await commitSettings({
    ambientMode: nextMode,
    artAmbient: nextMode !== "off",
  });

  useVinylDeckStore.getState().hydrateSettings(settings);
  applyVisualMode(settings.theme, settings.ambientMode);
  if (settings.ambientMode === "off") resetAmbientColors();
}

async function toggleLyricsEnabled() {
  const current = useVinylDeckStore.getState().settings.lyricsEnabled;
  const settings = await commitSettings({ lyricsEnabled: !current });
  useVinylDeckStore.getState().hydrateSettings(settings);
}

async function toggleLyricsLayout() {
  const currentLayout = useVinylDeckStore.getState().settings.lyricsLayout;
  const nextLayout = currentLayout === "split" ? "strip" : "split";
  const settings = await commitSettings({
    lyricsEnabled: true,
    lyricsLayout: nextLayout,
  });
  useVinylDeckStore.getState().hydrateSettings(settings);
}

async function toggleLyricsRomanized() {
  const current = useVinylDeckStore.getState().settings.lyricsRomanized;
  const settings = await commitSettings({ lyricsRomanized: !current });
  useVinylDeckStore.getState().hydrateSettings(settings);
}

async function toggleLyricsTranslated() {
  const current = useVinylDeckStore.getState().settings.lyricsTranslated;
  const settings = await commitSettings({ lyricsTranslated: !current });
  useVinylDeckStore.getState().hydrateSettings(settings);
}

function logShortcutError(error: unknown) {
  console.warn("[Shortcuts] Action failed:", error);
}
