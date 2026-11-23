// src/lib/lyrics/parsers.ts
// Pure parsing, track metadata normalization, script/language guards,
// auto-hide derivation, interlude gap insertion, enrichment parsing, and
// binary-search sync math. Zero DOM or network side effects.

import type {
  ActiveLyricPosition,
  LyricLine,
  LyricWord,
  LyricsDocument,
  LyricsEnrichmentResult,
  LyricsProvider,
  LyricsQuery,
  LyricsSinger,
  NormalizedTrackQuery,
} from "./types";

const DEFAULT_WORD_DURATION_MS = 380;
const DEFAULT_LINE_DURATION_MS = 3200;

/** Minimum silence before the first lyric line to display an intro dot interlude. */
export const INTRO_GAP_THRESHOLD_MS = 1200;
/** Minimum silence between two lyric lines to display a 3-dot instrumental interlude. */
export const INTERLUDE_GAP_THRESHOLD_MS = 3000;

const TITLE_NOISE_PATTERNS: RegExp[] = [
  /\s*[\(\[]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|lyric\s*video|lyrics|hd|4k|hq|explicit|clean|radio\s*edit|single\s*version|album\s*version|remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster(?:ed)?)\s*[\)\]]/gi,
  /\s+-\s+(?:single\s+version|radio\s+edit|remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster(?:ed)?)$/i,
];

const FEAT_SUFFIX_PATTERN =
  /\s*[\(\[]?\s*(?:feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]?/gi;

// Matches letters outside Latin script (Devanagari, Gurmukhi, CJK, Kana, Hangul,
// Arabic, Cyrillic, Thai, Greek, Hebrew, Bengali, Tamil, Telugu, etc.)
const NON_LATIN_SCRIPT_REGEX =
  /[\u0370-\u03FF\u0400-\u052F\u0590-\u06FF\u0750-\u077F\u0900-\u0D7F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

export function cleanTrackTitle(raw: string): string {
  let cleaned = raw.trim();
  for (const pattern of TITLE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

export function stripFeaturing(raw: string): string {
  return raw.replace(FEAT_SUFFIX_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

export function cleanArtistName(raw: string): string {
  return raw
    .trim()
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildTrackKey(
  track: string,
  artist: string,
  durationSeconds: number,
): string {
  const normTrack = cleanTrackTitle(track).toLowerCase();
  const normArtist = cleanArtistName(artist).toLowerCase();
  // Bucket duration to 2-second intervals so slight SMTC rounding still hits cache
  const durationBucket =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds / 2) * 2
      : 0;
  return `${normArtist}::${normTrack}::${durationBucket}`;
}

export function normalizeTrackQuery(query: LyricsQuery): NormalizedTrackQuery {
  const track = cleanTrackTitle(query.track || "");
  const artist = cleanArtistName(query.artist || "");
  const album = (query.album || "").trim();
  const duration =
    Number.isFinite(query.duration) && query.duration > 0
      ? Math.round(query.duration)
      : 0;

  return {
    track,
    artist,
    album,
    duration,
    trackKey: buildTrackKey(track, artist, duration),
  };
}

export function formatTimestampMs(ms: number): string {
  const safeSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Returns true if any lyric line (or raw text) contains non-Latin script characters.
 * Used to suppress redundant romanized controls on already-Latin tracks.
 */
export function hasNonLatinScript(input: string | Pick<LyricLine, "text">[]): boolean {
  if (typeof input === "string") {
    return NON_LATIN_SCRIPT_REGEX.test(input);
  }
  return input.some((line) => NON_LATIN_SCRIPT_REGEX.test(line.text));
}

/**
 * Normalizes language codes (e.g. "zh-CN" -> "zh", "en-US" -> "en") for
 * same-language translation suppression.
 */
/**
 * Guard against corrupted/merged romanizations (e.g. a whole song dumped into line 0).
 */
export function isSaneRomanization(original: string, candidate: string | undefined): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  if (/[\r\n]/.test(trimmed)) return false;
  const maxAllowed = Math.max(120, original.trim().length * 6);
  return trimmed.length <= maxAllowed;
}

export function normalizeLangCode(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

/**
 * Determines whether the LyricsStage column/strip should occupy stage space.
 * Automatically collapses back to centered Pure Vinyl when a track resolves as
 * instrumental or has no lyrics, without mutating the user's lyricsEnabled setting.
 */
export function shouldDisplayLyricsStage(
  lyricsEnabled: boolean,
  hasTrack: boolean,
  status: "idle" | "loading" | "ready" | "error",
  document: LyricsDocument | null,
): boolean {
  if (!lyricsEnabled || !hasTrack) return false;
  if (status === "loading" || status === "error") return true;
  if (!document) return false;
  return (
    document.kind === "word" ||
    document.kind === "line" ||
    document.kind === "plain"
  );
}

/**
 * Inserts synthetic 3-dot instrumental gap rows (intro >= 1.2s and inter-line
 * gaps >= 3.0s) for display & 60fps sync without mutating the underlying vocal
 * `document.lines` indices used for enrichment.
 */
export function buildDisplayLinesWithInterludes(lines: LyricLine[]): LyricLine[] {
  if (lines.length === 0) return [];

  const result: LyricLine[] = [];
  const first = lines[0];

  if (first.startMs >= INTRO_GAP_THRESHOLD_MS) {
    result.push({
      id: `interlude-intro-0-${Math.round(first.startMs)}`,
      startMs: 0,
      endMs: first.startMs,
      text: "",
      isInterlude: true,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    result.push(curr);

    const next = lines[i + 1];
    if (!next) continue;

    // Derive effective vocal end time (prefer last word end when word-synced)
    const vocalEndMs =
      curr.words && curr.words.length > 0
        ? Math.max(curr.words[curr.words.length - 1].endMs, curr.endMs)
        : curr.endMs;

    const gapMs = next.startMs - vocalEndMs;
    if (gapMs >= INTERLUDE_GAP_THRESHOLD_MS) {
      result.push({
        id: `interlude-${i}-${Math.round(vocalEndMs)}-${Math.round(next.startMs)}`,
        startMs: vocalEndMs,
        endMs: next.startMs,
        text: "",
        isInterlude: true,
      });
    }
  }

  return result;
}

// ── LyricsPlus JSON Parser ────────────────────────────────────

interface RawLyricsPlusSyllable {
  time?: unknown;
  duration?: unknown;
  text?: unknown;
  isBackground?: unknown;
}

interface RawLyricsPlusTextNode {
  text?: unknown;
  lang?: unknown;
}

interface RawLyricsPlusLine {
  time?: unknown;
  duration?: unknown;
  text?: unknown;
  syllabus?: unknown;
  words?: unknown;
  transliteration?: unknown;
  romanized?: unknown;
  translation?: unknown;
  element?: {
    singer?: unknown;
    isBackground?: unknown;
  };
}

interface RawLyricsPlusPayload {
  type?: unknown;
  lyrics?: unknown;
}

function readFiniteMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function mapSinger(rawSinger: unknown): LyricsSinger | undefined {
  if (typeof rawSinger !== "string") return undefined;
  const normalized = rawSinger.trim().toLowerCase();
  if (normalized === "v2" || normalized === "secondary" || normalized === "v1000") {
    return "secondary";
  }
  if (normalized === "v1" || normalized === "primary") {
    return "primary";
  }
  return undefined;
}

function readOptionalText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (value && typeof value === "object") {
    const node = value as RawLyricsPlusTextNode;
    if (typeof node.text === "string") {
      const trimmed = node.text.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }
  return undefined;
}

export function parseLyricsPlusResponse(
  payload: unknown,
  trackKey: string,
  provider: LyricsProvider = "lyricsplus",
): LyricsDocument | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as RawLyricsPlusPayload;
  if (!Array.isArray(data.lyrics) || data.lyrics.length === 0) return null;

  const lines: LyricLine[] = [];
  let hasWordTimings = false;

  for (let i = 0; i < data.lyrics.length; i++) {
    const rawLine = data.lyrics[i] as RawLyricsPlusLine | null;
    if (!rawLine || typeof rawLine !== "object") continue;

    const startMs = readFiniteMs(rawLine.time);
    const rawDuration = readFiniteMs(rawLine.duration);
    const rawTokens = Array.isArray(rawLine.syllabus)
      ? rawLine.syllabus
      : Array.isArray(rawLine.words)
        ? rawLine.words
        : [];

    const words: LyricWord[] = [];
    for (const item of rawTokens) {
      if (!item || typeof item !== "object") continue;
      const syl = item as RawLyricsPlusSyllable;
      const tokenText = typeof syl.text === "string" ? syl.text : "";
      const tokenStart = readFiniteMs(syl.time);
      if (tokenText.length === 0 || tokenStart === null) continue;
      const tokenDur = readFiniteMs(syl.duration);
      const tokenEnd =
        tokenDur !== null && tokenDur > 0
          ? tokenStart + tokenDur
          : tokenStart + DEFAULT_WORD_DURATION_MS;
      words.push({
        text: tokenText,
        startMs: tokenStart,
        endMs: tokenEnd,
        isBackground: Boolean(syl.isBackground),
      });
    }

    const lineStart = startMs ?? (words.length > 0 ? words[0].startMs : null);
    if (lineStart === null) continue;

    const textFromField =
      typeof rawLine.text === "string" ? rawLine.text.trim() : "";
    const textFromWords = words.map((w) => w.text).join("").trim();
    const text = textFromField || textFromWords;
    if (!text) continue;

    const normalizedWords =
      words.length > 0
        ? finalizeWords(stripOuterBgParens(words), lineStart, rawDuration)
        : undefined;
    if (normalizedWords && normalizedWords.length > 0) {
      hasWordTimings = true;
    }

    const lineEnd =
      rawDuration !== null && rawDuration > 0
        ? lineStart + rawDuration
        : normalizedWords && normalizedWords.length > 0
          ? normalizedWords[normalizedWords.length - 1].endMs
          : lineStart + DEFAULT_LINE_DURATION_MS;

    const isBackground =
      Boolean(rawLine.element?.isBackground) ||
      (normalizedWords !== undefined &&
        normalizedWords.length > 0 &&
        normalizedWords.every((w) => w.isBackground));

    // Native LyricsPlus v2 transliteration / romanization & translation metadata
    const nativeRomanized =
      readOptionalText(rawLine.transliteration) ??
      readOptionalText(rawLine.romanized);

    let nativeTranslations: Record<string, string> | undefined;
    const rawTr = rawLine.translation;
    if (rawTr && typeof rawTr === "object") {
      const node = rawTr as RawLyricsPlusTextNode;
      const trText = readOptionalText(node.text);
      const trLang = normalizeLangCode(
        typeof node.lang === "string" ? node.lang : "en",
      );
      if (trText && trLang) {
        nativeTranslations = { [trLang]: trText };
      }
    } else if (typeof rawTr === "string" && rawTr.trim()) {
      nativeTranslations = { en: rawTr.trim() };
    }

    lines.push({
      id: `lp-${i}-${Math.round(lineStart)}`,
      startMs: lineStart,
      endMs: Math.max(lineEnd, lineStart + 150),
      text,
      words: normalizedWords,
      singer: mapSinger(rawLine.element?.singer),
      isBackground: isBackground || undefined,
      romanized: isSaneRomanization(text, nativeRomanized) ? nativeRomanized : undefined,
      translations: nativeTranslations,
    });
  }

  if (lines.length === 0) return null;

  const finalized = finalizeLines(lines);
  return {
    kind: hasWordTimings ? "word" : "line",
    provider,
    lines: finalized,
    trackKey,
    hasNonLatinScript: hasNonLatinScript(finalized),
  };
}

// ── TTML XML Parser (Apple Music / BetterLyrics format) ──────

export function parseTtmlTimestampToMs(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  // Format: "123.45s" or "1234ms"
  const msMatch = value.match(/^(\d+(?:\.\d+)?)ms$/i);
  if (msMatch) return Math.round(Number(msMatch[1]));

  const secMatch = value.match(/^(\d+(?:\.\d+)?)s$/i);
  if (secMatch) return Math.round(Number(secMatch[1]) * 1000);

  // Format: "HH:MM:SS.mmm", "MM:SS.mmm", or "SS.mmm"
  const parts = value.split(":");
  if (parts.length === 1) {
    const secs = Number(parts[0]);
    return Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : null;
  }
  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    return Math.round((mins * 60 + secs) * 1000);
  }
  if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (!Number.isFinite(hrs) || !Number.isFinite(mins) || !Number.isFinite(secs)) {
      return null;
    }
    return Math.round((hrs * 3600 + mins * 60 + secs) * 1000);
  }
  return null;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function readXmlAttr(attrs: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attrs.match(
    new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? decodeXmlEntities(match[1] ?? match[2] ?? "") : null;
}

interface TtmlSpanFrame {
  isBg: boolean;
  isRoman: boolean;
  isTranslation: boolean;
  lang: string;
  begin: number | null;
  end: number | null;
  hasChildSpan: boolean;
  textBuf: string;
}

interface ParsedTtmlParagraph {
  words: LyricWord[];
  leadText: string;
  romanized?: string;
  translations?: Record<string, string>;
}

/**
 * Strips outer parentheses from contiguous background-vocal word runs so
 * `(What's happenin'?)` renders cleanly as `What's happenin'?` on its tucked
 * sub-line (matching Apple Music & Liquid-Lyrics presentation).
 */
function stripOuterBgParens(words: LyricWord[]): LyricWord[] {
  const result = words.map((w) => ({ ...w }));
  let i = 0;
  while (i < result.length) {
    if (!result[i].isBackground) {
      i += 1;
      continue;
    }
    let end = i;
    while (end + 1 < result.length && result[end + 1].isBackground) {
      end += 1;
    }

    const first = result[i];
    const last = result[end];
    const firstTrim = first.text.trimStart();
    const lastTrim = last.text.trimEnd();

    if (firstTrim.startsWith("(") && lastTrim.endsWith(")")) {
      first.text = first.text.replace(/^(\s*)\(/, "$1");
      last.text = last.text.replace(/\)(\s*)$/, "$1");
    }

    i = end + 1;
  }

  return result.filter((w) => w.text.trim().length > 0);
}

/**
 * Depth-aware XML stack parser for TTML `<p>` and `<text>` bodies.
 * Properly handles arbitrarily nested `<span ttm:role="x-bg"><span begin="...">`
 * structures without the non-greedy regex truncation bug that dropped the first
 * background word (e.g. `(Drop` / `(What's` / `(Nope)`).
 */
function parseTtmlFragment(
  fragment: string,
  inheritedBackground: boolean,
): ParsedTtmlParagraph {
  const words: LyricWord[] = [];
  const leadParts: string[] = [];
  let romanized: string | undefined;
  let translations: Record<string, string> | undefined;

  const stack: TtmlSpanFrame[] = [];
  const tokenRegex = /<span\b([^>]*)\/>|<span\b([^>]*)>|<\/span>|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(fragment)) !== null) {
    const selfClosingAttrs = match[1];
    const openAttrs = match[2];
    const textChunk = match[3];

    if (selfClosingAttrs !== undefined) {
      continue;
    }

    if (openAttrs !== undefined) {
      const parent = stack[stack.length - 1];
      if (parent) parent.hasChildSpan = true;

      const role = readXmlAttr(openAttrs, "ttm:role")?.trim().toLowerCase();
      const beginRaw = readXmlAttr(openAttrs, "begin");
      const endRaw = readXmlAttr(openAttrs, "end");
      const lang =
        normalizeLangCode(readXmlAttr(openAttrs, "xml:lang")) ||
        normalizeLangCode(readXmlAttr(openAttrs, "lang")) ||
        "en";

      stack.push({
        isBg: (parent?.isBg ?? inheritedBackground) || role === "x-bg",
        isRoman: (parent?.isRoman ?? false) || role === "x-roman",
        isTranslation: (parent?.isTranslation ?? false) || role === "x-translation",
        lang,
        begin: beginRaw ? parseTtmlTimestampToMs(beginRaw) : null,
        end: endRaw ? parseTtmlTimestampToMs(endRaw) : null,
        hasChildSpan: false,
        textBuf: "",
      });
      continue;
    }

    if (textChunk !== undefined) {
      const decoded = decodeXmlEntities(textChunk);
      const top = stack[stack.length - 1];
      if (!top) {
        if (decoded.trim()) {
          leadParts.push(decoded);
        } else if (decoded.length > 0 && words.length > 0) {
          const prev = words[words.length - 1];
          if (!prev.isBackground && !/\s$/.test(prev.text)) {
            prev.text = `${prev.text} `;
          }
        }
        continue;
      }

      if (top.isRoman || top.isTranslation) {
        top.textBuf += decoded;
      } else if (top.hasChildSpan) {
        // Inter-span whitespace inside a wrapper like <span ttm:role="x-bg">
        if (decoded.length > 0 && /\s/.test(decoded) && words.length > 0) {
          const prev = words[words.length - 1];
          if (!/\s$/.test(prev.text)) {
            prev.text = `${prev.text} `;
          }
        }
      } else {
        top.textBuf += decoded;
      }
      continue;
    }

    // Closing </span>
    const frame = stack.pop();
    if (!frame) continue;

    if (frame.isRoman && !stack.some((f) => f.isRoman)) {
      const clean = frame.textBuf.replace(/\s+/g, " ").trim();
      if (clean) romanized = romanized ? `${romanized} ${clean}` : clean;
      continue;
    }

    if (frame.isTranslation && !stack.some((f) => f.isTranslation)) {
      const clean = frame.textBuf.replace(/\s+/g, " ").trim();
      if (clean) {
        translations = translations ?? {};
        translations[frame.lang] = translations[frame.lang]
          ? `${translations[frame.lang]} ${clean}`
          : clean;
      }
      continue;
    }

    if (!frame.hasChildSpan && frame.textBuf.trim()) {
      const cleanText = frame.textBuf;
      if (!frame.isBg) {
        leadParts.push(cleanText);
      }
      if (frame.begin !== null) {
        words.push({
          text: cleanText,
          startMs: frame.begin,
          endMs:
            frame.end !== null && frame.end > frame.begin
              ? frame.end
              : frame.begin + DEFAULT_WORD_DURATION_MS,
          isBackground: frame.isBg || undefined,
        });
      }
    }
  }

  // Ensure words inside the same vocal track have spaces when TTML omits inter-span whitespace
  const cleanedWords = stripOuterBgParens(words);
  const leadWordsText = cleanedWords
    .filter((w) => !w.isBackground)
    .map((w) => w.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const fallbackLead = leadParts.join(" ").replace(/\s+/g, " ").trim();

  return {
    words: cleanedWords,
    leadText: leadWordsText || fallbackLead,
    romanized,
    translations,
  };
}

function extractTimedSpans(
  fragment: string,
  inheritedBackground: boolean,
  out: LyricWord[],
): void {
  const parsed = parseTtmlFragment(fragment, inheritedBackground);
  for (const w of parsed.words) {
    out.push(w);
  }
}

interface TtmlHeadTransliteration {
  text: string;
  words?: LyricWord[];
}

function parseTtmlHeadMetadata(xml: string): {
  transliterations: Map<string, TtmlHeadTransliteration>;
  translations: Map<string, Record<string, string>>;
} {
  const transliterations = new Map<string, TtmlHeadTransliteration>();
  const translations = new Map<string, Record<string, string>>();

  // Extract <transliterations><transliteration ...><text for="L#">...</text></transliteration></transliterations>
  const translitBlocks = xml.matchAll(/<transliteration\b[^>]*>([\s\S]*?)<\/transliteration>/gi);
  for (const block of translitBlocks) {
    const innerBlock = block[1] ?? "";
    const textNodes = innerBlock.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi);
    for (const node of textNodes) {
      const attrs = node[1] ?? "";
      const body = node[2] ?? "";
      const forKey = readXmlAttr(attrs, "for")?.trim();
      if (!forKey || transliterations.has(forKey)) continue;

      const timedWords: LyricWord[] = [];
      extractTimedSpans(body, false, timedWords);
      const plain = decodeXmlEntities(body.replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim();
      if (!plain) continue;

      transliterations.set(forKey, {
        text: plain,
        words:
          timedWords.length > 0
            ? finalizeWords(timedWords, timedWords[0].startMs, null)
            : undefined,
      });
    }
  }

  // Extract <translations><translation xml:lang="en"><text for="L#">...</text></translation></translations>
  const transBlocks = xml.matchAll(/<translation\b([^>]*)>([\s\S]*?)<\/translation>/gi);
  for (const block of transBlocks) {
    const attrs = block[1] ?? "";
    const innerBlock = block[2] ?? "";
    const lang =
      normalizeLangCode(readXmlAttr(attrs, "xml:lang")) ||
      normalizeLangCode(readXmlAttr(attrs, "lang")) ||
      "en";
    const textNodes = innerBlock.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi);
    for (const node of textNodes) {
      const nAttrs = node[1] ?? "";
      const body = node[2] ?? "";
      const forKey = readXmlAttr(nAttrs, "for")?.trim();
      if (!forKey) continue;
      const plain = decodeXmlEntities(body.replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim();
      if (!plain) continue;
      const existing = translations.get(forKey) ?? {};
      if (!existing[lang]) {
        existing[lang] = plain;
        translations.set(forKey, existing);
      }
    }
  }

  return { transliterations, translations };
}

export function parseTtmlLyrics(
  xml: string,
  trackKey: string,
  provider: LyricsProvider = "betterlyrics",
): LyricsDocument | null {
  if (!xml || typeof xml !== "string" || !xml.includes("<p")) return null;

  const headMeta = parseTtmlHeadMetadata(xml);
  const lines: LyricLine[] = [];
  let hasWordTimings = false;
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  let lineIdx = 0;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pAttrs = pMatch[1] ?? "";
    const rawPBody = pMatch[2] ?? "";

    const pBeginRaw = readXmlAttr(pAttrs, "begin");
    const pEndRaw = readXmlAttr(pAttrs, "end");
    const agent = readXmlAttr(pAttrs, "ttm:agent");
    const pRole = readXmlAttr(pAttrs, "ttm:role")?.trim().toLowerCase();
    const itunesKey = readXmlAttr(pAttrs, "itunes:key")?.trim();
    const pBegin = pBeginRaw ? parseTtmlTimestampToMs(pBeginRaw) : null;
    const pEnd = pEndRaw ? parseTtmlTimestampToMs(pEndRaw) : null;

    const parsedFragment = parseTtmlFragment(rawPBody, pRole === "x-bg");
    const { words, romanized, translations } = parsedFragment;

    const startMs = pBegin ?? (words.length > 0 ? words[0].startMs : null);
    if (startMs === null) continue;

    const fallbackFullText = decodeXmlEntities(rawPBody.replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    const strippedText = parsedFragment.leadText || fallbackFullText;
    if (!strippedText) continue;

    const normalizedWords =
      words.length > 0 ? finalizeWords(words, startMs, null) : undefined;
    if (normalizedWords && normalizedWords.length > 0) {
      hasWordTimings = true;
    }

    const endMs =
      pEnd !== null && pEnd > startMs
        ? pEnd
        : normalizedWords && normalizedWords.length > 0
          ? normalizedWords[normalizedWords.length - 1].endMs
          : startMs + DEFAULT_LINE_DURATION_MS;

    const isBackground =
      pRole === "x-bg" ||
      (normalizedWords !== undefined &&
        normalizedWords.length > 0 &&
        normalizedWords.every((w) => w.isBackground));

    const headTranslit = itunesKey ? headMeta.transliterations.get(itunesKey) : undefined;
    const headTrans = itunesKey ? headMeta.translations.get(itunesKey) : undefined;
    const mergedRom = romanized ?? headTranslit?.text;
    const saneRom = isSaneRomanization(strippedText, mergedRom) ? mergedRom : undefined;
    const mergedTranslations =
      translations || headTrans
        ? { ...(headTrans ?? {}), ...(translations ?? {}) }
        : undefined;

    lines.push({
      id: `ttml-${lineIdx}-${startMs}`,
      startMs,
      endMs: Math.max(endMs, startMs + 150),
      text: strippedText,
      words: normalizedWords,
      singer: mapSinger(agent),
      isBackground: isBackground || undefined,
      romanized: saneRom,
      romanizedTimedWords: saneRom ? headTranslit?.words : undefined,
      translations: mergedTranslations,
    });
    lineIdx += 1;
  }

  if (lines.length === 0) return null;

  const finalized = finalizeLines(lines);
  return {
    kind: hasWordTimings ? "word" : "line",
    provider,
    lines: finalized,
    trackKey,
    hasNonLatinScript: hasNonLatinScript(finalized),
  };
}

// ── LRC & Enhanced LRC Parser (LRCLIB format) ────────────────

function parseLrcTagToMs(minutes: string, seconds: string, frac?: string): number {
  const mins = Number(minutes);
  const secs = Number(seconds);
  let millis = 0;
  if (frac) {
    if (frac.length === 1) millis = Number(frac) * 100;
    else if (frac.length === 2) millis = Number(frac) * 10;
    else millis = Number(frac.slice(0, 3));
  }
  return Math.round((mins * 60 + secs) * 1000 + millis);
}

function parseEnhancedLrcWords(
  rawText: string,
  lineStartMs: number,
): LyricWord[] | undefined {
  const tagRegex = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;
  const matches = Array.from(rawText.matchAll(tagRegex));
  if (matches.length === 0) return undefined;

  const words: LyricWord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const startMs = parseLrcTagToMs(m[1], m[2], m[3]);
    const textStart = (m.index ?? 0) + m[0].length;
    const textEnd =
      i + 1 < matches.length ? (matches[i + 1].index ?? rawText.length) : rawText.length;
    const chunk = rawText.slice(textStart, textEnd);
    if (!chunk.trim()) continue;
    const nextStart =
      i + 1 < matches.length
        ? parseLrcTagToMs(matches[i + 1][1], matches[i + 1][2], matches[i + 1][3])
        : startMs + DEFAULT_WORD_DURATION_MS;
    words.push({
      text: chunk,
      startMs,
      endMs: Math.max(nextStart, startMs + 120),
    });
  }

  if (words.length === 0) return undefined;
  return finalizeWords(words, lineStartMs, null);
}

export function parseLrcLyrics(
  lrc: string,
  durationSeconds: number,
  trackKey: string,
  provider: LyricsProvider = "lrclib",
): LyricsDocument | null {
  if (!lrc || typeof lrc !== "string") return null;

  const rawLines = lrc.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  let hasWordTimings = false;
  let globalOffsetMs = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const offsetMatch = trimmed.match(/^\[offset:\s*([+-]?\d+)\s*\]$/i);
    if (offsetMatch) {
      globalOffsetMs = Number(offsetMatch[1]) || 0;
      continue;
    }

    const timeTags = Array.from(
      trimmed.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    );
    if (timeTags.length === 0) continue;

    const lastTag = timeTags[timeTags.length - 1];
    const body = trimmed.slice((lastTag.index ?? 0) + lastTag[0].length).trim();
    if (!body) continue;

    for (let t = 0; t < timeTags.length; t++) {
      const tag = timeTags[t];
      const startMs = Math.max(
        0,
        parseLrcTagToMs(tag[1], tag[2], tag[3]) - globalOffsetMs,
      );
      const enhancedWords = parseEnhancedLrcWords(body, startMs);
      if (enhancedWords && enhancedWords.length > 0) {
        hasWordTimings = true;
      }
      const cleanText = body
        .replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!cleanText) continue;

      parsed.push({
        id: `lrc-${parsed.length}-${startMs}`,
        startMs,
        endMs: startMs + DEFAULT_LINE_DURATION_MS,
        text: cleanText,
        words: enhancedWords,
      });
    }
  }

  if (parsed.length === 0) return null;

  const totalDurationMs =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds * 1000)
      : undefined;

  const finalized = finalizeLines(parsed, totalDurationMs);
  return {
    kind: hasWordTimings ? "word" : "line",
    provider,
    lines: finalized,
    trackKey,
    hasNonLatinScript: hasNonLatinScript(finalized),
  };
}

// ── Google Translate GTX Single-Line Enrichment Parser ───────

export interface GtxSingleLineResult {
  sourceLang: string;
  romanized: string;
  translated: string;
}

/**
 * Parses a single-line Google Translate `gtx` response (`dt=t&dt=rm`) into
 * clean single-line translated + romanized strings plus detected source language.
 * Querying one line per request guarantees 1:1 alignment and eliminates GTX's
 * multi-line romanization newline-stripping bug.
 */
export function parseGtxSingleLineResponse(
  payload: unknown,
): GtxSingleLineResult | null {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;

  const segments = payload[0] as unknown[];
  const translatedParts: string[] = [];
  const romanizedParts: string[] = [];

  for (const seg of segments) {
    if (!Array.isArray(seg)) continue;
    if (typeof seg[0] === "string") {
      translatedParts.push(seg[0]);
    }
    if (typeof seg[3] === "string" && seg[3].trim()) {
      romanizedParts.push(seg[3].trim());
    }
  }

  const sourceLang =
    typeof payload[2] === "string" ? normalizeLangCode(payload[2]) : "";

  return {
    sourceLang,
    translated: translatedParts.join("").replace(/\s+/g, " ").trim(),
    romanized: romanizedParts.join(" ").replace(/\s+/g, " ").trim(),
  };
}

/**
 * Legacy multi-line helper retained for unit-test compatibility.
 */
export function parseGtxEnrichmentResponse(
  payload: unknown,
  expectedLineCount: number,
): LyricsEnrichmentResult | null {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;

  const segments = payload[0] as unknown[];
  const translatedChunks: string[] = [];
  const romanizedChunks: string[] = [];

  for (const seg of segments) {
    if (!Array.isArray(seg)) continue;
    if (typeof seg[0] === "string") {
      translatedChunks.push(seg[0]);
    }
    if (typeof seg[3] === "string" && seg[3].trim()) {
      romanizedChunks.push(seg[3]);
    }
  }

  const sourceLang =
    typeof payload[2] === "string" ? normalizeLangCode(payload[2]) : "";

  const splitAndPad = (joined: string): string[] => {
    if (!joined.trim()) return [];
    const split = joined.split(/\r?\n/).map((line) => line.trim());
    if (expectedLineCount <= 0) return split;
    const aligned = split.slice(0, expectedLineCount);
    while (aligned.length < expectedLineCount) {
      aligned.push("");
    }
    return aligned;
  };

  return {
    sourceLang,
    translatedLines: splitAndPad(translatedChunks.join("")),
    romanizedLines: splitAndPad(romanizedChunks.join("\n")),
  };
}

// ── Normalization helpers ─────────────────────────────────────

function finalizeWords(
  words: LyricWord[],
  lineStartMs: number,
  lineDurationMs: number | null,
): LyricWord[] {
  // Preserve exact source reading order — NEVER sort by startMs, because
  // overlapping background vocals (e.g. "(Drop it)") often begin before the
  // preceding lead word finishes and sorting would scramble the sentence.
  const normalized = words.map((w) => ({ ...w }));
  for (let i = 0; i < normalized.length; i++) {
    const curr = normalized[i];
    const next = normalized[i + 1];
    const sameVocalTrack =
      next !== undefined && Boolean(curr.isBackground) === Boolean(next.isBackground);

    if (curr.endMs <= curr.startMs) {
      curr.endMs =
        sameVocalTrack && next && next.startMs > curr.startMs
          ? Math.max(next.startMs, curr.startMs + 80)
          : lineDurationMs
            ? Math.max(lineStartMs + lineDurationMs, curr.startMs + 160)
            : curr.startMs + DEFAULT_WORD_DURATION_MS;
    }
    if (
      sameVocalTrack &&
      next &&
      next.startMs >= curr.startMs &&
      curr.endMs > next.startMs + 120
    ) {
      curr.endMs = Math.max(curr.startMs + 80, next.startMs);
    }
  }
  return normalized;
}

function finalizeLines(
  lines: LyricLine[],
  totalDurationMs?: number,
): LyricLine[] {
  const sorted = [...lines].sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];

    if (next) {
      if (!curr.words || curr.words.length === 0) {
        curr.endMs = Math.max(curr.startMs + 200, next.startMs);
      } else if (curr.endMs <= curr.startMs) {
        curr.endMs = Math.max(curr.startMs + 200, next.startMs);
      }
    } else if (totalDurationMs && totalDurationMs > curr.startMs) {
      if (!curr.words || curr.words.length === 0) {
        curr.endMs = Math.min(curr.startMs + 6000, totalDurationMs);
      }
    }

    curr.id = `${curr.id}-${i}`;
  }

  return sorted;
}

// ── Binary-Search Sync Solver (60fps hot path) ────────────────

export function findActiveLyricPosition(
  lines: LyricLine[],
  timeMs: number,
): ActiveLyricPosition {
  if (lines.length === 0 || !Number.isFinite(timeMs)) {
    return { lineIndex: -1, wordIndex: -1, wordProgress: 0 };
  }

  if (timeMs < lines[0].startMs) {
    return { lineIndex: -1, wordIndex: -1, wordProgress: 0 };
  }

  // Binary search for the last line with startMs <= timeMs
  let lo = 0;
  let hi = lines.length - 1;
  let lineIndex = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startMs <= timeMs) {
      lineIndex = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const activeLine = lines[lineIndex];

  // For synthetic interlude gap rows, compute 0..1 progress across the gap
  if (activeLine.isInterlude) {
    const span = Math.max(1, activeLine.endMs - activeLine.startMs);
    const progress = Math.min(1, Math.max(0, (timeMs - activeLine.startMs) / span));
    return { lineIndex, wordIndex: -1, wordProgress: progress };
  }

  const words = activeLine.words;
  if (!words || words.length === 0) {
    return { lineIndex, wordIndex: -1, wordProgress: 1 };
  }

  // Words remain in reading order (overlapping background vocals may have
  // non-monotonic startMs), so scan linearly across the line's short word list.
  let wordIndex = -1;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    if (timeMs >= word.startMs && timeMs < word.endMs) {
      wordIndex = w;
      break;
    }
    if (word.startMs <= timeMs) {
      wordIndex = w;
    }
  }
  if (wordIndex < 0) {
    return { lineIndex, wordIndex: -1, wordProgress: 0 };
  }

  const activeWord = words[wordIndex];
  const wordSpan = Math.max(1, activeWord.endMs - activeWord.startMs);
  const wordProgress = Math.min(
    1,
    Math.max(0, (timeMs - activeWord.startMs) / wordSpan),
  );

  return { lineIndex, wordIndex, wordProgress };
}
