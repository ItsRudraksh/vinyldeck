import { isTauri } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { useVinylDeckStore } from "../playback/store";
import { resetAmbientColors } from "../themes/applier";
import { DEFAULT_SETTINGS, WINDOW_MODES } from "./types";
import type { PersistedSettings } from "./types";
import type { ThemeId } from "../themes/applier";

const STORE_FILE = "settings.json";
const STORE_KEY = "settings";
const LEGACY_SETTINGS_HANDOFF_KEY = "vinyldeck:settings-handoff";
const STORE_DEFAULTS = { [STORE_KEY]: DEFAULT_SETTINGS };
const SAVE_DELAY_MS = 400;
const THEME_IDS: ThemeId[] = ["noir", "glass", "aurora", "vapor", "paper"];

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function validateSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const raw = value as Record<string, unknown>;
  const theme = isTheme(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme;
  const windowMode = isWindowMode(raw.windowMode) ? raw.windowMode : DEFAULT_SETTINGS.windowMode;

  return {
    version: 1,
    theme,
    artAmbient: theme === "noir" ? readBoolean(raw.artAmbient, DEFAULT_SETTINGS.artAmbient) : false,
    vinylWobble: readBoolean(raw.vinylWobble, DEFAULT_SETTINGS.vinylWobble),
    filmGrain: readBoolean(raw.filmGrain, DEFAULT_SETTINGS.filmGrain),
    leanBackMode: readBoolean(raw.leanBackMode, DEFAULT_SETTINGS.leanBackMode),
    cursorHide: readBoolean(raw.cursorHide, DEFAULT_SETTINGS.cursorHide),
    idleTimeoutSeconds: readIdleTimeout(raw.idleTimeoutSeconds),
    alwaysOnTop: readBoolean(raw.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
    windowMode,
  };
}

export async function loadSettings(): Promise<PersistedSettings> {
  if (!isTauri()) return DEFAULT_SETTINGS;
  clearLegacySettingsHandoff();

  try {
    const store = await load(STORE_FILE, { defaults: STORE_DEFAULTS, autoSave: false });
    return validateSettings(await store.get(STORE_KEY));
  } catch (error) {
    console.warn("[Settings] Load failed:", error);
    return DEFAULT_SETTINGS;
  }
}

export function subscribeToSettingsPersistence(): () => void {
  if (!isTauri()) return () => {};

  return useVinylDeckStore.subscribe(
    (state) => state.settings,
    (settings) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void saveSettings(settings);
      }, SAVE_DELAY_MS);
    },
  );
}

export async function flushSettingsPersistence(): Promise<void> {
  if (!isTauri()) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  await saveSettings(useVinylDeckStore.getState().settings);
}

async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    const store = await load(STORE_FILE, { defaults: STORE_DEFAULTS, autoSave: false });
    await store.set(STORE_KEY, settings);
    await store.save();
  } catch (error) {
    console.warn("[Settings] Save failed:", error);
  }
}

function clearLegacySettingsHandoff(): void {
  try {
    window.localStorage.removeItem(LEGACY_SETTINGS_HANDOFF_KEY);
  } catch {
    // Ignore unavailable storage; desktop settings come from Tauri Store.
  }
}

function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

function isWindowMode(value: unknown): value is PersistedSettings["windowMode"] {
  return typeof value === "string" && WINDOW_MODES.includes(value as PersistedSettings["windowMode"]);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readIdleTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.idleTimeoutSeconds;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function sanitizeSettingsForTheme(settings: PersistedSettings): PersistedSettings {
  if (settings.theme === "noir") return settings;
  if (settings.artAmbient) resetAmbientColors();
  return { ...settings, artAmbient: false };
}
