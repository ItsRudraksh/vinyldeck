import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useVinylDeckStore } from "../playback/store";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  isLegacyThemeId,
  isThemeId,
  legacyThemeToAmbientMode,
  legacyThemeToShell,
  normalizeAmbientMode,
  resetAmbientColors,
} from "../themes/applier";
import {
  DEFAULT_SETTINGS,
  LYRICS_FONT_FAMILIES,
  LYRICS_FONT_SIZES,
  LYRICS_LAYOUTS,
  LYRICS_SIDES,
  LYRICS_TARGET_LANGS,
  WINDOW_MODES,
} from "./types";
import type {
  LyricsFontFamily,
  LyricsFontSize,
  LyricsLayout,
  LyricsSide,
  LyricsTargetLang,
  PersistedSettings,
} from "./types";
import type { AmbientModeId, LegacyThemeId, ThemeId } from "../themes/applier";

export const SETTINGS_CHANGED_EVENT = "settings-changed";

const LEGACY_SETTINGS_HANDOFF_KEY = "vinyldeck:settings-handoff";

export type SettingsPatch = Partial<Omit<PersistedSettings, "version">>;

export function validateSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const raw = value as Record<string, unknown>;
  const rawTheme = isLegacyThemeId(raw.theme)
    ? raw.theme
    : DEFAULT_SETTINGS.theme;
  const legacyTheme = rawTheme as LegacyThemeId;
  const theme: ThemeId = isThemeId(rawTheme)
    ? rawTheme
    : legacyThemeToShell(legacyTheme);
  const legacyArtAmbient = readBoolean(raw.artAmbient, false);
  const rawAmbientMode = raw.ambientMode;
  const ambientMode: AmbientModeId =
    typeof rawAmbientMode === "string"
      ? normalizeAmbientMode(rawAmbientMode)
      : legacyThemeToAmbientMode(legacyTheme, legacyArtAmbient);
  const windowMode = isWindowMode(raw.windowMode)
    ? raw.windowMode
    : DEFAULT_SETTINGS.windowMode;
  const lyricsLayout = isLyricsLayout(raw.lyricsLayout)
    ? raw.lyricsLayout
    : DEFAULT_SETTINGS.lyricsLayout;
  const lyricsTargetLang = isLyricsTargetLang(raw.lyricsTargetLang)
    ? raw.lyricsTargetLang
    : DEFAULT_SETTINGS.lyricsTargetLang;
  const lyricsFontFamily = isLyricsFontFamily(raw.lyricsFontFamily)
    ? raw.lyricsFontFamily
    : DEFAULT_SETTINGS.lyricsFontFamily;
  const lyricsFontSize = isLyricsFontSize(raw.lyricsFontSize)
    ? raw.lyricsFontSize
    : DEFAULT_SETTINGS.lyricsFontSize;
  const lyricsSide = isLyricsSide(raw.lyricsSide)
    ? raw.lyricsSide
    : DEFAULT_SETTINGS.lyricsSide;

  return {
    version: 2,
    theme,
    ambientMode,
    artAmbient: ambientMode !== "off",
    vinylWobble: readBoolean(raw.vinylWobble, DEFAULT_SETTINGS.vinylWobble),
    filmGrain: readBoolean(raw.filmGrain, DEFAULT_SETTINGS.filmGrain),
    leanBackMode: readBoolean(raw.leanBackMode, DEFAULT_SETTINGS.leanBackMode),
    cursorHide: readBoolean(raw.cursorHide, DEFAULT_SETTINGS.cursorHide),
    idleTimeoutSeconds: readIdleTimeout(raw.idleTimeoutSeconds),
    alwaysOnTop: readBoolean(raw.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
    keyboardShortcutsEnabled: readBoolean(
      raw.keyboardShortcutsEnabled,
      DEFAULT_SETTINGS.keyboardShortcutsEnabled,
    ),
    quitToTray: readBoolean(raw.quitToTray, DEFAULT_SETTINGS.quitToTray),
    startWithWindows: readBoolean(
      raw.startWithWindows,
      DEFAULT_SETTINGS.startWithWindows,
    ),
    windowMode,
    miniTransparentMode: readBoolean(
      raw.miniTransparentMode,
      DEFAULT_SETTINGS.miniTransparentMode,
    ),
    lyricsEnabled: readBoolean(
      raw.lyricsEnabled,
      DEFAULT_SETTINGS.lyricsEnabled,
    ),
    lyricsLayout,
    lyricsRomanized: readBoolean(
      raw.lyricsRomanized,
      DEFAULT_SETTINGS.lyricsRomanized,
    ),
    lyricsAutoRomanize: readBoolean(
      raw.lyricsAutoRomanize,
      DEFAULT_SETTINGS.lyricsAutoRomanize,
    ),
    lyricsTranslated: readBoolean(
      raw.lyricsTranslated,
      DEFAULT_SETTINGS.lyricsTranslated,
    ),
    lyricsTargetLang,
    lyricsFontFamily,
    lyricsFontSize,
    lyricsSide,
  };
}

export async function loadSettings(): Promise<PersistedSettings> {
  if (!isTauri()) return DEFAULT_SETTINGS;
  clearLegacySettingsHandoff();

  try {
    return validateSettings(
      await invoke<PersistedSettings>("cmd_settings_snapshot"),
    );
  } catch (error) {
    console.warn("[Settings] Snapshot failed:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function commitSettings(
  patch: SettingsPatch,
): Promise<PersistedSettings> {
  const normalizedPatch = normalizePatch(patch);

  if (!isTauri()) {
    const current = useVinylDeckStore.getState().settings;
    const settings = validateSettings({ ...current, ...normalizedPatch });
    useVinylDeckStore.getState().hydrateSettings(settings);
    applyVisualMode(settings.theme, settings.ambientMode);
    return settings;
  }

  // Optimistic local update for instant zero-lag UI response
  const current = useVinylDeckStore.getState().settings;
  const optimistic = validateSettings({ ...current, ...normalizedPatch });
  useVinylDeckStore.getState().hydrateSettings(optimistic);

  const backend = await invoke<Record<string, unknown>>("cmd_settings_update", {
    patch: normalizedPatch,
  });
  // Preserve newly patched fields even if a stale dev binary hasn't rebuilt Rust yet
  return validateSettings({ ...optimistic, ...backend, ...normalizedPatch });
}

export async function resetSettings(): Promise<PersistedSettings> {
  if (!isTauri()) {
    useVinylDeckStore.getState().hydrateSettings(DEFAULT_SETTINGS);
    applyVisualMode(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.ambientMode);
    return DEFAULT_SETTINGS;
  }

  return validateSettings(
    await invoke<PersistedSettings>("cmd_settings_reset"),
  );
}

export async function subscribeToSettingsChanges(
  callback: (settings: PersistedSettings) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};

  return listen<Record<string, unknown>>(SETTINGS_CHANGED_EVENT, ({ payload }) => {
    const current = useVinylDeckStore.getState().settings;
    callback(validateSettings({ ...current, ...payload }));
  });
}

function normalizePatch(patch: SettingsPatch): SettingsPatch {
  const next: SettingsPatch = { ...patch };
  if (patch.artAmbient !== undefined && patch.ambientMode === undefined) {
    next.ambientMode = patch.artAmbient ? ART_AMBIENT_MODE : "off";
  }
  if (patch.ambientMode !== undefined) {
    next.ambientMode = normalizeAmbientMode(patch.ambientMode);
    next.artAmbient = next.ambientMode !== "off";
  }
  return next;
}

function clearLegacySettingsHandoff(): void {
  try {
    window.localStorage.removeItem(LEGACY_SETTINGS_HANDOFF_KEY);
  } catch {
    // Ignore unavailable storage; desktop settings come from backend Store.
  }
}

function isWindowMode(
  value: unknown,
): value is PersistedSettings["windowMode"] {
  return (
    typeof value === "string" &&
    WINDOW_MODES.includes(value as PersistedSettings["windowMode"])
  );
}

function isLyricsLayout(value: unknown): value is LyricsLayout {
  return (
    typeof value === "string" &&
    LYRICS_LAYOUTS.includes(value as LyricsLayout)
  );
}

function isLyricsTargetLang(value: unknown): value is LyricsTargetLang {
  return (
    typeof value === "string" &&
    LYRICS_TARGET_LANGS.includes(value as LyricsTargetLang)
  );
}

function isLyricsFontFamily(value: unknown): value is LyricsFontFamily {
  return (
    typeof value === "string" &&
    LYRICS_FONT_FAMILIES.includes(value as LyricsFontFamily)
  );
}

function isLyricsFontSize(value: unknown): value is LyricsFontSize {
  return (
    typeof value === "string" &&
    LYRICS_FONT_SIZES.includes(value as LyricsFontSize)
  );
}

function isLyricsSide(value: unknown): value is LyricsSide {
  return (
    typeof value === "string" &&
    LYRICS_SIDES.includes(value as LyricsSide)
  );
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readIdleTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.idleTimeoutSeconds;
  }
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function sanitizeSettingsForTheme(
  settings: PersistedSettings,
): PersistedSettings {
  const next = validateSettings(settings);
  if (next.ambientMode === "off") resetAmbientColors();
  return next;
}
