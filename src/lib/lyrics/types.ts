// src/lib/lyrics/types.ts
// Shared lyrics data model used across Rust backend payloads, browser cascade
// providers, offline romanizer, 60fps sync solver, enrichment, and LyricsStage.

export const LYRICS_LAYOUTS = ["split", "strip"] as const;
export type LyricsLayout = (typeof LYRICS_LAYOUTS)[number];

export const LYRICS_FONT_FAMILIES = ["display", "sans", "serif", "mono"] as const;
export type LyricsFontFamily = (typeof LYRICS_FONT_FAMILIES)[number];

export const LYRICS_FONT_FAMILY_META: Record<
  LyricsFontFamily,
  { label: string; note: string; stack: string }
> = {
  display: {
    label: "Display",
    note: "Sora · expressive",
    stack: 'var(--font-display, "Sora"), system-ui, sans-serif',
  },
  sans: {
    label: "Clean Sans",
    note: "Inter · balanced",
    stack: 'var(--font-body, "Inter"), system-ui, sans-serif',
  },
  serif: {
    label: "Editorial",
    note: "Caslon · classic",
    stack: '"Libre Caslon Text", Georgia, serif',
  },
  mono: {
    label: "Studio Mono",
    note: "JetBrains · crisp",
    stack: 'var(--font-mono, "JetBrains Mono"), monospace',
  },
};

export const LYRICS_FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type LyricsFontSize = (typeof LYRICS_FONT_SIZES)[number];

export const LYRICS_FONT_SIZE_LABELS: Record<LyricsFontSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra Large",
};

export const LYRICS_SIDES = ["right", "left"] as const;
export type LyricsSide = (typeof LYRICS_SIDES)[number];

export const LYRICS_TARGET_LANGS = [
  "en",
  "es",
  "fr",
  "de",
  "hi",
  "pa",
  "ja",
  "ko",
  "zh",
  "pt",
  "ar",
  "ru",
] as const;
export type LyricsTargetLang = (typeof LYRICS_TARGET_LANGS)[number];

export const LYRICS_TARGET_LANG_LABELS: Record<LyricsTargetLang, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  pa: "Punjabi",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  pt: "Portuguese",
  ar: "Arabic",
  ru: "Russian",
};

export type LyricsKind =
  | "word"
  | "line"
  | "plain"
  | "instrumental"
  | "not_found";

export type LyricsProvider =
  | "lyricsplus"
  | "betterlyrics"
  | "lrclib"
  | "demo";

export type LyricsSinger = "primary" | "secondary";

export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
  isBackground?: boolean;
}

export interface LyricLine {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words?: LyricWord[];
  singer?: LyricsSinger;
  isBackground?: boolean;
  /** True for synthetic instrumental gap rows (intro or >=3s inter-line gaps). */
  isInterlude?: boolean;
  /** Phonetic romanization (native Apple Music TTML, offline, or per-line enriched). */
  romanized?: string;
  /** Optional per-word romanized tokens aligned 1:1 with `words` for karaoke sweep replacement. */
  romanizedWords?: string[];
  /** Optional native syllable-timed romanized words (from Apple Music TTML iTunesMetadata). */
  romanizedTimedWords?: LyricWord[];
  /** Optional translations keyed by ISO 639-1 language code (e.g. "en"). */
  translations?: Record<string, string>;
}

export interface LyricsDocument {
  kind: LyricsKind;
  provider: LyricsProvider;
  lines: LyricLine[];
  plainText?: string;
  trackKey: string;
  /** Detected source language code when enriched (e.g. "ja", "pa", "ko", "en"). */
  sourceLang?: string;
  /** Whether the track's lyric lines contain non-Latin script characters. */
  hasNonLatinScript?: boolean;
}

export interface LyricsEnrichmentResult {
  sourceLang: string;
  romanizedLines: string[];
  translatedLines: string[];
}

export interface LyricsQuery {
  track: string;
  artist: string;
  album: string;
  duration: number;
  sourceName?: string;
}

export interface NormalizedTrackQuery {
  track: string;
  artist: string;
  album: string;
  duration: number;
  trackKey: string;
}

export interface ActiveLyricPosition {
  lineIndex: number;
  wordIndex: number;
  /** 0..1 fill progress for the active word or active interlude gap (1 if line-level only). */
  wordProgress: number;
}
