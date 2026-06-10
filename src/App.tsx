// src/App.tsx
// Root component. Initializes MockSource → Zustand store → MainView.
// All Stage 2 sub-stages wired here.

import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { createMockSource } from "./lib/playback/mockSource";
import { createTauriSource } from "./lib/playback/tauriSource";
import { useVinylDeckStore } from "./lib/playback/store";
import {
  flushSettingsPersistence,
  loadSettings,
  sanitizeSettingsForTheme,
  subscribeToSettingsPersistence,
} from "./lib/settings";
import { applyTheme, resetAmbientColors } from "./lib/themes/applier";
import {
  getCurrentRenderWindowMode,
  setNativeAlwaysOnTop,
  setNativeWindowMode,
} from "./lib/window";
import type { RenderWindowMode } from "./lib/window/types";
import { MainView } from "./views/MainView";
import { MiniView } from "./views/MiniView";

function App() {
  const setSource = useVinylDeckStore((s) => s.setSource);
  const [renderMode, setRenderMode] = useState<RenderWindowMode>("main");

  useEffect(() => {
    const forceMockSource = import.meta.env.VITE_FORCE_MOCK_SOURCE === "true";
    let source = isTauri() && !forceMockSource ? createTauriSource() : createMockSource();
    let unsubscribeSettings = () => {};
    let cancelled = false;
    // Only the main WebView is allowed to write persisted settings.
    // Mini reads settings on boot (so it matches the current theme) but
    // NEVER subscribes as a writer and NEVER flushes on cleanup.
    // This prevents the mini window from poisoning the Tauri Store with
    // DEFAULT_SETTINGS ("noir") if it is destroyed before hydration finishes,
    // or from racing main as a second concurrent writer.
    let isSettingsAuthority = false;

    async function start() {
      const settings = sanitizeSettingsForTheme(await loadSettings());
      if (cancelled) return;

      useVinylDeckStore.getState().hydrateSettings(settings);
      applyTheme(settings.theme);
      if (settings.theme !== "noir" || !settings.artAmbient)
        resetAmbientColors();

      const currentRenderMode = await getCurrentRenderWindowMode();
      if (cancelled) return;
      setRenderMode(currentRenderMode);

      // Only main window manages native window state and settings persistence.
      if (currentRenderMode === "main") {
        isSettingsAuthority = true;
        await setNativeWindowMode(
          settings.windowMode === "mini" ? "main" : settings.windowMode,
        );
        await setNativeAlwaysOnTop(settings.alwaysOnTop);
        unsubscribeSettings = subscribeToSettingsPersistence();
        window.addEventListener("beforeunload", handleBeforeUnload);
      }

      setSource(source);
    }

    void start();

    function handleBeforeUnload() {
      void flushSettingsPersistence();
    }

    // Cleanup on unmount (hot reload safe)
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Guard: only flush if this WebView owns settings. Mini must never write.
      if (isSettingsAuthority) {
        void flushSettingsPersistence();
      }
      unsubscribeSettings();
      source.stop();
    };
    // setSource is stable (Zustand action, never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return renderMode === "mini" ? <MiniView /> : <MainView />;
}

export default App;
