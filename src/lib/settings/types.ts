import type { AmbientModeId, ThemeId } from "../themes/applier";
import { WINDOW_MODES } from "../window/types";
import type { WindowMode } from "../window/types";

export { WINDOW_MODES };
export type { WindowMode };

export interface PersistedSettings {
  version: 2;
  theme: ThemeId;
  ambientMode: AmbientModeId;
  /** Legacy compatibility flag. Derived from ambientMode and kept for old callers/tests. */
  artAmbient: boolean;
  vinylWobble: boolean;
  filmGrain: boolean;
  leanBackMode: boolean;
  cursorHide: boolean;
  idleTimeoutSeconds: number;
  alwaysOnTop: boolean;
  windowMode: WindowMode;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  version: 2,
  theme: "noir",
  ambientMode: "off",
  artAmbient: false,
  vinylWobble: true,
  filmGrain: true,
  leanBackMode: true,
  cursorHide: true,
  idleTimeoutSeconds: 3,
  alwaysOnTop: false,
  windowMode: "main",
};
