// src/App.tsx
// Root component. Hydrates backend-approved settings, attaches the runtime
// playback source, and routes the current window to MainView or MiniView.

import { useEffect, useState } from "react";
import { createPlaybackSource } from "./lib/playback/sourceFactory";
import { useVinylDeckStore } from "./lib/playback/store";
import {
  loadSettings,
  sanitizeSettingsForTheme,
  subscribeToSettingsChanges,
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
  const clearSource = useVinylDeckStore((s) => s.clearSource);
  const [renderMode, setRenderMode] = useState<RenderWindowMode>("main");

  useEffect(() => {
    const source = createPlaybackSource();
    let unsubscribeSettings = () => {};
    let cancelled = false;

    function applySettings(settings: Awaited<ReturnType<typeof loadSettings>>) {
      const safeSettings = sanitizeSettingsForTheme(settings);
      useVinylDeckStore.getState().hydrateSettings(safeSettings);
      applyTheme(safeSettings.theme);
      if (safeSettings.theme !== "noir" || !safeSettings.artAmbient)
        resetAmbientColors();
      return safeSettings;
    }

    async function start() {
      const settings = applySettings(await loadSettings());
      if (cancelled) return;

      unsubscribeSettings = await subscribeToSettingsChanges((nextSettings) => {
        applySettings(nextSettings);
      });
      if (cancelled) {
        unsubscribeSettings();
        return;
      }

      const currentRenderMode = await getCurrentRenderWindowMode();
      if (cancelled) return;
      setRenderMode(currentRenderMode);

      // Only main window applies persisted native window state at startup.
      if (currentRenderMode === "main") {
        await setNativeWindowMode(
          settings.windowMode === "mini" ? "main" : settings.windowMode,
        );
        await setNativeAlwaysOnTop(settings.alwaysOnTop);
      }

      setSource(source);
    }

    void start();

    // Cleanup on unmount (hot reload safe)
    return () => {
      cancelled = true;
      unsubscribeSettings();
      clearSource(source);
    };
    // setSource/clearSource are stable (Zustand actions, never change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return renderMode === "mini" ? <MiniView /> : <MainView />;
}

export default App;
