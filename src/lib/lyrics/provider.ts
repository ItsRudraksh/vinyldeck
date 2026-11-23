// src/lib/lyrics/provider.ts
// Multi-tier free lyrics cascade + zero-key romanization/translation enrichment:
//   Tauri runtime   -> Rust backend cmd_lyrics_fetch / cmd_lyrics_enrich (zero CORS, native cache)
//   Browser runtime -> LyricsPlus mirrors -> BetterLyrics TTML -> LRCLIB + per-line GTX fallback
//   MockSource      -> Deterministic word/line/instrumental demo fixtures

import { invoke, isTauri } from "@tauri-apps/api/core";
import { getDemoLyricsForTrack } from "./demoLyrics";
import {
  hasNonLatinScript,
  normalizeLangCode,
  normalizeTrackQuery,
  parseGtxSingleLineResponse,
  parseLrcLyrics,
  parseLyricsPlusResponse,
  parseTtmlLyrics,
  stripFeaturing,
} from "./parsers";
import type {
  LyricsDocument,
  LyricsEnrichmentResult,
  LyricsQuery,
  LyricsTargetLang,
  NormalizedTrackQuery,
} from "./types";

const LYRICSPLUS_MIRRORS = [
  "https://lyricsplus.prjktla.workers.dev",
  "https://lyricsplus.binimum.org",
  "https://lyricsplus.atomix.one",
] as const;

const BETTERLYRICS_ENDPOINT = "https://lyrics-api.boidu.dev/getLyrics";
const LRCLIB_GET_ENDPOINT = "https://lrclib.net/api/get";
const LRCLIB_SEARCH_ENDPOINT = "https://lrclib.net/api/search";
const GTX_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single";

const CACHE_STORAGE_KEY = "vinyldeck:lyrics-cache:v4";
const ENRICH_STORAGE_KEY = "vinyldeck:lyrics-enrich:v3";
const MAX_MEMORY_CACHE = 40;
const MIRROR_TIMEOUT_MS = 3500;
const LRCLIB_TIMEOUT_MS = 4000;
const ENRICH_TIMEOUT_MS = 5000;
const MAX_CONCURRENT_ENRICH = 5;

interface BackendRawLyricsResponse {
  provider: string;
  format: string;
  payload: string;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

const memoryCache = new Map<string, LyricsDocument>();
const enrichMemoryCache = new Map<string, LyricsEnrichmentResult>();

function rememberCached(trackKey: string, doc: LyricsDocument): void {
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(trackKey, doc);

  if (doc.kind === "not_found") return;
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, LyricsDocument>;
    const keys = Object.keys(parsed);
    if (keys.length >= 25) {
      delete parsed[keys[0]];
    }
    parsed[trackKey] = doc;
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore quota failures
  }
}

function readCached(trackKey: string): LyricsDocument | null {
  const mem = memoryCache.get(trackKey);
  if (mem) return mem;

  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, LyricsDocument>;
    const doc = parsed[trackKey];
    if (doc && doc.trackKey === trackKey) {
      memoryCache.set(trackKey, doc);
      return doc;
    }
  } catch {
    // Ignore corrupted storage
  }
  return null;
}

function readEnrichCached(cacheKey: string): LyricsEnrichmentResult | null {
  const mem = enrichMemoryCache.get(cacheKey);
  if (mem) return mem;

  try {
    const raw = window.localStorage.getItem(ENRICH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, LyricsEnrichmentResult>;
    const hit = parsed[cacheKey];
    if (hit) {
      enrichMemoryCache.set(cacheKey, hit);
      return hit;
    }
  } catch {
    // Ignore corrupted storage
  }
  return null;
}

function rememberEnrichCached(
  cacheKey: string,
  result: LyricsEnrichmentResult,
): void {
  if (enrichMemoryCache.size >= MAX_MEMORY_CACHE) {
    const oldest = enrichMemoryCache.keys().next().value;
    if (oldest) enrichMemoryCache.delete(oldest);
  }
  enrichMemoryCache.set(cacheKey, result);

  try {
    const raw = window.localStorage.getItem(ENRICH_STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<
      string,
      LyricsEnrichmentResult
    >;
    const keys = Object.keys(parsed);
    if (keys.length >= 25) {
      delete parsed[keys[0]];
    }
    parsed[cacheKey] = result;
    window.localStorage.setItem(ENRICH_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore quota failures
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) {
      window.clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json, text/xml, application/xml, text/plain" },
    });
  } finally {
    window.clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}

async function fetchFromLyricsPlus(
  norm: NormalizedTrackQuery,
  signal?: AbortSignal,
): Promise<LyricsDocument | null> {
  const params = new URLSearchParams({
    title: norm.track,
    artist: norm.artist,
    source: "apple,musixmatch,spotify",
  });
  if (norm.album) params.set("album", norm.album);
  if (norm.duration > 0) params.set("duration", String(norm.duration));

  for (const baseUrl of LYRICSPLUS_MIRRORS) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/v2/lyrics/get?${params.toString()}`,
        MIRROR_TIMEOUT_MS,
        signal,
      );
      if (!response.ok) continue;
      const json = (await response.json()) as unknown;
      const doc = parseLyricsPlusResponse(json, norm.trackKey, "lyricsplus");
      if (doc && doc.lines.length > 0) return doc;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
        throw error;
      }
    }
  }
  return null;
}

async function fetchFromBetterLyrics(
  norm: NormalizedTrackQuery,
  signal?: AbortSignal,
): Promise<LyricsDocument | null> {
  const params = new URLSearchParams({
    s: norm.track,
    a: norm.artist,
  });
  if (norm.album) params.set("al", norm.album);
  if (norm.duration > 0) params.set("d", String(norm.duration));

  try {
    const response = await fetchWithTimeout(
      `${BETTERLYRICS_ENDPOINT}?${params.toString()}`,
      MIRROR_TIMEOUT_MS,
      signal,
    );
    if (!response.ok) return null;
    const text = await response.text();
    let ttml = text;
    if (text.trim().startsWith("{")) {
      const parsed = JSON.parse(text) as { ttml?: string; lyrics?: string };
      ttml = parsed.ttml || parsed.lyrics || "";
    }
    return parseTtmlLyrics(ttml, norm.trackKey, "betterlyrics");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
      throw error;
    }
    return null;
  }
}

interface LrcLibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
  duration?: number;
}

function parseLrcLibRecord(
  record: LrcLibRecord,
  norm: NormalizedTrackQuery,
): LyricsDocument | null {
  if (record.instrumental) {
    return {
      kind: "instrumental",
      provider: "lrclib",
      lines: [],
      trackKey: norm.trackKey,
    };
  }
  if (record.syncedLyrics) {
    const doc = parseLrcLyrics(
      record.syncedLyrics,
      record.duration || norm.duration,
      norm.trackKey,
      "lrclib",
    );
    if (doc && doc.lines.length > 0) return doc;
  }
  if (record.plainLyrics && record.plainLyrics.trim()) {
    const plain = record.plainLyrics.trim();
    return {
      kind: "plain",
      provider: "lrclib",
      lines: [],
      plainText: plain,
      trackKey: norm.trackKey,
      hasNonLatinScript: hasNonLatinScript(plain),
    };
  }
  return null;
}

async function fetchFromLrcLib(
  norm: NormalizedTrackQuery,
  signal?: AbortSignal,
): Promise<LyricsDocument | null> {
  const exactParams = new URLSearchParams({
    track_name: norm.track,
    artist_name: norm.artist,
  });
  if (norm.album) exactParams.set("album_name", norm.album);
  if (norm.duration > 0) exactParams.set("duration", String(norm.duration));

  try {
    const res = await fetchWithTimeout(
      `${LRCLIB_GET_ENDPOINT}?${exactParams.toString()}`,
      LRCLIB_TIMEOUT_MS,
      signal,
    );
    if (res.ok) {
      const record = (await res.json()) as LrcLibRecord;
      const doc = parseLrcLibRecord(record, norm);
      if (doc) return doc;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
      throw error;
    }
  }

  const strippedTrack = stripFeaturing(norm.track);
  const searchParams = new URLSearchParams({
    track_name: strippedTrack || norm.track,
    artist_name: norm.artist,
  });
  try {
    const res = await fetchWithTimeout(
      `${LRCLIB_SEARCH_ENDPOINT}?${searchParams.toString()}`,
      LRCLIB_TIMEOUT_MS,
      signal,
    );
    if (!res.ok) return null;
    const records = (await res.json()) as LrcLibRecord[];
    if (!Array.isArray(records) || records.length === 0) return null;

    const scored = [...records].sort((a, b) => {
      const aSynced = a.syncedLyrics ? 0 : 1;
      const bSynced = b.syncedLyrics ? 0 : 1;
      if (aSynced !== bSynced) return aSynced - bSynced;
      if (norm.duration > 0) {
        const aDiff = Math.abs((a.duration ?? norm.duration) - norm.duration);
        const bDiff = Math.abs((b.duration ?? norm.duration) - norm.duration);
        return aDiff - bDiff;
      }
      return 0;
    });

    for (const candidate of scored) {
      if (
        norm.duration > 0 &&
        typeof candidate.duration === "number" &&
        Math.abs(candidate.duration - norm.duration) > 12
      ) {
        continue;
      }
      const doc = parseLrcLibRecord(candidate, norm);
      if (doc) return doc;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
      throw error;
    }
  }

  return null;
}

function parseBackendRawResponse(
  raw: BackendRawLyricsResponse,
  norm: NormalizedTrackQuery,
): LyricsDocument | null {
  if (raw.instrumental) {
    return {
      kind: "instrumental",
      provider: "lrclib",
      lines: [],
      trackKey: norm.trackKey,
    };
  }

  if (raw.format === "lyricsplus_json") {
    try {
      return parseLyricsPlusResponse(
        JSON.parse(raw.payload),
        norm.trackKey,
        "lyricsplus",
      );
    } catch {
      return null;
    }
  }

  if (raw.format === "ttml") {
    return parseTtmlLyrics(raw.payload, norm.trackKey, "betterlyrics");
  }

  if (raw.format === "lrc") {
    return parseLrcLyrics(raw.payload, norm.duration, norm.trackKey, "lrclib");
  }

  if (raw.format === "plain" && (raw.plainLyrics || raw.payload)) {
    const plain = (raw.plainLyrics || raw.payload).trim();
    return {
      kind: "plain",
      provider: "lrclib",
      lines: [],
      plainText: plain,
      trackKey: norm.trackKey,
      hasNonLatinScript: hasNonLatinScript(plain),
    };
  }

  return null;
}

export async function fetchLyricsForTrack(
  query: LyricsQuery,
  options?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<LyricsDocument> {
  const norm = normalizeTrackQuery(query);
  if (!norm.track) {
    return {
      kind: "not_found",
      provider: "lrclib",
      lines: [],
      trackKey: norm.trackKey,
    };
  }

  if (!options?.bypassCache) {
    const cached = readCached(norm.trackKey);
    if (cached) return cached;
  }

  if (query.sourceName === "MockSource") {
    const demo = getDemoLyricsForTrack(query.track, query.artist, query.duration);
    if (demo) {
      rememberCached(norm.trackKey, demo);
      return demo;
    }
  }

  if (isTauri()) {
    try {
      const raw = await invoke<BackendRawLyricsResponse | null>(
        "cmd_lyrics_fetch",
        {
          query: {
            track: norm.track,
            artist: norm.artist,
            album: norm.album,
            duration: norm.duration,
            bypassCache: Boolean(options?.bypassCache),
          },
        },
      );
      if (raw) {
        const parsed = parseBackendRawResponse(raw, norm);
        if (parsed) {
          rememberCached(norm.trackKey, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.warn("[Lyrics] Backend fetch failed, falling back to web:", error);
    }
  }

  const tier1 = await fetchFromLyricsPlus(norm, options?.signal);
  if (tier1 && tier1.kind === "word") {
    rememberCached(norm.trackKey, tier1);
    return tier1;
  }

  const tier2 = await fetchFromBetterLyrics(norm, options?.signal);
  if (tier2 && tier2.kind === "word") {
    rememberCached(norm.trackKey, tier2);
    return tier2;
  }

  const lineCandidate = tier1 ?? tier2;

  const tier3 = await fetchFromLrcLib(norm, options?.signal);
  if (tier3) {
    if (tier3.kind === "plain" && lineCandidate) {
      rememberCached(norm.trackKey, lineCandidate);
      return lineCandidate;
    }
    rememberCached(norm.trackKey, tier3);
    return tier3;
  }

  if (lineCandidate) {
    rememberCached(norm.trackKey, lineCandidate);
    return lineCandidate;
  }

  const notFound: LyricsDocument = {
    kind: "not_found",
    provider: "lrclib",
    lines: [],
    trackKey: norm.trackKey,
  };
  rememberCached(norm.trackKey, notFound);
  return notFound;
}

// ── Free Zero-Key Per-Line Romanization & Translation Enrichment ──

async function fetchEnrichmentViaBrowserGtx(
  lines: string[],
  targetLang: LyricsTargetLang,
  signal?: AbortSignal,
): Promise<LyricsEnrichmentResult | null> {
  const uniqueMap = new Map<string, number[]>();
  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const bucket = uniqueMap.get(trimmed);
    if (bucket) bucket.push(idx);
    else uniqueMap.set(trimmed, [idx]);
  });

  if (uniqueMap.size === 0) return null;

  const entries = Array.from(uniqueMap.entries());
  const allTranslated = lines.map(() => "");
  const allRomanized = lines.map(() => "");
  const langCounts = new Map<string, number>();
  let anySuccess = false;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < entries.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const [text, indices] = entries[cursor++];
      const params = new URLSearchParams();
      params.set("client", "gtx");
      params.set("sl", "auto");
      params.set("tl", targetLang);
      params.append("dt", "t");
      params.append("dt", "rm");
      params.set("q", text);

      try {
        const res = await fetchWithTimeout(
          `${GTX_TRANSLATE_ENDPOINT}?${params.toString()}`,
          ENRICH_TIMEOUT_MS,
          signal,
        );
        if (!res.ok) continue;
        const json = (await res.json()) as unknown;
        const parsed = parseGtxSingleLineResponse(json);
        if (!parsed) continue;
        anySuccess = true;
        if (parsed.sourceLang) {
          langCounts.set(
            parsed.sourceLang,
            (langCounts.get(parsed.sourceLang) ?? 0) + indices.length,
          );
        }
        for (const idx of indices) {
          allRomanized[idx] = parsed.romanized;
          allTranslated[idx] = parsed.translated;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
          throw error;
        }
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_ENRICH, entries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (!anySuccess) return null;

  let detectedLang = "";
  let bestCount = 0;
  for (const [lang, count] of langCounts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      detectedLang = lang;
    }
  }

  return {
    sourceLang: detectedLang,
    translatedLines: allTranslated,
    romanizedLines: allRomanized,
  };
}

/**
 * Enriches a resolved LyricsDocument with per-line phonetic romanization and/or
 * target-language translation without mutating primary word timestamps.
 */
export async function enrichLyricsForTrack(
  doc: LyricsDocument,
  targetLang: LyricsTargetLang,
  options?: { signal?: AbortSignal },
): Promise<LyricsEnrichmentResult | null> {
  if (doc.lines.length === 0) return null;

  const normalizedTarget = normalizeLangCode(targetLang) as LyricsTargetLang;
  const cacheKey = `${doc.trackKey}::${normalizedTarget}`;
  const cached = readEnrichCached(cacheKey);
  if (cached) return cached;

  const rawLines = doc.lines.map((l) => l.text);
  let result: LyricsEnrichmentResult | null = null;

  if (isTauri()) {
    try {
      const backendResult = await invoke<LyricsEnrichmentResult | null>(
        "cmd_lyrics_enrich",
        {
          query: {
            trackKey: doc.trackKey,
            lines: rawLines,
            targetLang: normalizedTarget,
          },
        },
      );
      if (backendResult) {
        result = backendResult;
      }
    } catch (error) {
      console.warn("[Lyrics] Backend enrichment failed, trying browser fallback:", error);
    }
  }

  if (!result) {
    result = await fetchEnrichmentViaBrowserGtx(
      rawLines,
      normalizedTarget,
      options?.signal,
    );
  }

  if (result) {
    rememberEnrichCached(cacheKey, result);
  }
  return result;
}
