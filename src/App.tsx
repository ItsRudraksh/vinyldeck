// src/App.tsx
// Root component. Initializes MockSource → Zustand store → MainView.
// All Stage 2 sub-stages wired here.

import { useEffect } from "react";
import { createMockSource } from "./lib/playback/mockSource";
import { useVinylDeckStore } from "./lib/playback/store";
import { MainView } from "./views/MainView";

function App() {
  const setSource = useVinylDeckStore((s) => s.setSource);

  useEffect(() => {
    // Initialize MockSource on mount
    const source = createMockSource();
    setSource(source);

    // Cleanup on unmount (hot reload safe)
    return () => {
      source.stop();
    };
  // setSource is stable (Zustand action, never changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MainView />;
}

export default App;
