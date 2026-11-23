import type { AmbientModeId, ThemeId } from "../themes/applier";
import {
  LYRICS_FONT_FAMILIES,
  LYRICS_FONT_SIZES,
  LYRICS_LAYOUTS,
  LYRICS_SIDES,
  LYRICS_TARGET_LANGS,
} from "../lyrics/types";
import type {
  LyricsFontFamily,
  LyricsFontSize,
  LyricsLayout,
  LyricsSide,
  LyricsTargetLang,
} from "../lyrics/types";
import { WINDOW_MODES } from "../window/types";
import type { WindowMode } from "../window/types";

export {
  LYRICS_FONT_FAMILIES,
  LYRICS_FONT_SIZES,
  LYRICS_LAYOUTS,
  LYRICS_SIDES,
  LYRICS_TARGET_LANGS,
  WINDOW_MODES,
};
export type {
  LyricsFontFamily,
  LyricsFontSize,
  LyricsLayout,
  LyricsSide,
  LyricsTargetLang,
  WindowMode,
};

export interface PersistedSettings {
  version: 2;
  theme: ThemeId;
  /** v2 field kept, but only off/on values are exposed now: off | beam. */
  ambientMode: AmbientModeId;
  /** Legacy compatibility flag. Derived from ambientMode and kept for old callers/tests. */
  artAmbient: boolean;
  vinylWobble: boolean;
  filmGrain: boolean;
  leanBackMode: boolean;
  cursorHide: boolean;
  idleTimeoutSeconds: number;
  alwaysOnTop: boolean;
  keyboardShortcutsEnabled: boolean;
  quitToTray: boolean;
  startWithWindows: boolean;
  windowMode: WindowMode;
  /**
   * Mini-only. Applies a native Windows Acrylic blur-through effect on the
   * Mini window and lets its background go fully transparent so the desktop
   * shows through behind the vinyl/controls. Has no effect on Main/Fullscreen.
   */
  miniTransparentMode: boolean;
  /** Main/Fullscreen realtime lyrics visibility. */
  lyricsEnabled: boolean;
  /** Main/Fullscreen realtime lyrics layout: side-by-side split or compact strip. */
  lyricsLayout: LyricsLayout;
  /** Replace non-Latin lyric lines with phonetic Latin romanization. */
  lyricsRomanized: boolean;
  /** Automatically enable romanization when a track contains non-Latin script (never auto-translates). */
  lyricsAutoRomanize: boolean;
  /** Show translated subtitles beneath lyric lines when track language differs (manual only). */
  lyricsTranslated: boolean;
  /** ISO 639-1 target language code for translated lyrics (default: "en"). */
  lyricsTargetLang: LyricsTargetLang;
  /** Lyrics typography family preset. */
  lyricsFontFamily: LyricsFontFamily;
  /** Lyrics typography scale preset. */
  lyricsFontSize: LyricsFontSize;
  /** Split View lyrics side relative to the vinyl turntable. */
  lyricsSide: LyricsSide;
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
  keyboardShortcutsEnabled: true,
  quitToTray: true,
  startWithWindows: false,
  windowMode: "main",
  miniTransparentMode: false,
  lyricsEnabled: true,
  lyricsLayout: "split",
  lyricsRomanized: false,
  lyricsAutoRomanize: true,
  lyricsTranslated: false,
  lyricsTargetLang: "en",
  lyricsFontFamily: "display",
  lyricsFontSize: "md",
  lyricsSide: "right",
};
