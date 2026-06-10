// src/App.tsx
// Root component. Initializes MockSource → Zustand store → MainView.
// All Stage 2 sub-stages wired here.

import { useEffect } from "react";
import { createMockSource } from "./lib/playback/mockSource";
import { useVinylDeckStore } from "./lib/playback/store";
import { flushSettingsPersistence, loadSettings, sanitizeSettingsForTheme, subscribeToSettingsPersistence } from "./lib/settings";
import { applyTheme, resetAmbientColors } from "./lib/themes/applier";
import { MainView } from "./views/MainView";

function App() {
  const setSource = useVinylDeckStore((s) => s.setSource);

  useEffect(() => {
    let source = createMockSource();
    let unsubscribeSettings = () => {};
    let cancelled = false;

    async function start() {
      const settings = sanitizeSettingsForTheme(await loadSettings());
      if (cancelled) return;

      useVinylDeckStore.getState().hydrateSettings(settings);
      applyTheme(settings.theme);
      if (settings.theme !== "noir" || !settings.artAmbient) resetAmbientColors();

      unsubscribeSettings = subscribeToSettingsPersistence();
      window.addEventListener("beforeunload", handleBeforeUnload);
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
      void flushSettingsPersistence();
      unsubscribeSettings();
      source.stop();
    };
  // setSource is stable (Zustand action, never changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MainView />;
}

export default App;
