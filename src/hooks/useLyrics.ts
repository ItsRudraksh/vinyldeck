// src/hooks/useLyrics.ts
// Manages track-change lyrics resolution, stale-request cancellation, retry,
// instant offline romanization (Korean Hangul, Japanese Kana, Punjabi Gurmukhi,
// Hindi Devanagari), native Apple Music TTML transliterations, and per-line
// network enrichment for Kanji/Chinese/etc. & translations.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hasNonLatinScript,
  isSaneRomanization,
  normalizeLangCode,
  normalizeTrackQuery,
} from "../lib/lyrics/parsers";
import { enrichLyricsForTrack, fetchLyricsForTrack } from "../lib/lyrics/provider";
import {
  alignRomanizedWords,
  canRomanizeOffline,
  romanizeOffline,
  romanizeWordTokensOffline,
} from "../lib/lyrics/romanize";
import type {
  LyricLine,
  LyricsDocument,
  LyricsQuery,
  LyricsTargetLang,
} from "../lib/lyrics/types";

export type LyricsStatus = "idle" | "loading" | "ready" | "error";

export interface UseLyricsOptions {
  enabled: boolean;
  romanized: boolean;
  translated: boolean;
  targetLang: LyricsTargetLang;
}

export interface UseLyricsResult {
  status: LyricsStatus;
  document: LyricsDocument | null;
  trackKey: string;
  isEnriching: boolean;
  /** True when track lyrics contain non-Latin characters (romanization meaningful). */
  hasNonLatin: boolean;
  /** True when detected source language already matches targetLang. */
  isSameAsTargetLang: boolean;
  /** Increments whenever romanized/translated data attaches, so scroll can recenter. */
  enrichmentNonce: number;
  retry: () => void;
}

/**
 * Applies instant offline romanization (Hangul, Kana, Gurmukhi, Devanagari) and
 * aligns any native or offline romanized text onto timed `words`.
 */
function applyOfflineRomanizationToDoc(doc: LyricsDocument): LyricsDocument {
  if (!doc.lines.length) return doc;

  let changed = false;
  const nextLines: LyricLine[] = doc.lines.map((line) => {
    let romanized = isSaneRomanization(line.text, line.romanized)
      ? line.romanized
      : undefined;
    let romanizedWords = line.romanizedWords;

    if (!romanized && canRomanizeOffline(line.text)) {
      const offline = romanizeOffline(line.text).trim();
      if (offline && offline !== line.text.trim() && isSaneRomanization(line.text, offline)) {
        romanized = offline;
      }
    }

    // If native Apple Music TTML already provided syllable-timed romaji words, keep them directly
    if (!line.romanizedTimedWords && !romanizedWords && line.words && line.words.length > 0) {
      const offlineWords = romanizeWordTokensOffline(line.words);
      if (offlineWords) {
        romanizedWords = offlineWords;
        if (!romanized) {
          romanized = offlineWords.join("").replace(/\s+/g, " ").trim();
        }
      } else if (romanized) {
        romanizedWords = alignRomanizedWords(line.words, romanized) ?? undefined;
      }
    }

    if (romanized === line.romanized && romanizedWords === line.romanizedWords) {
      return line;
    }
    changed = true;
    return {
      ...line,
      romanized,
      romanizedWords,
    };
  });

  return changed ? { ...doc, lines: nextLines } : doc;
}

export function useLyrics(
  query: LyricsQuery,
  options: UseLyricsOptions,
): UseLyricsResult {
  const { enabled, romanized, translated, targetLang } = options;
  const norm = normalizeTrackQuery(query);
  const trackKey = norm.track ? norm.trackKey : "";

  const [status, setStatus] = useState<LyricsStatus>("idle");
  const [doc, setDoc] = useState<LyricsDocument | null>(null);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichmentNonce, setEnrichmentNonce] = useState<number>(0);
  const [retryToken, setRetryToken] = useState<number>(0);

  const requestIdRef = useRef<number>(0);
  const enrichIdRef = useRef<number>(0);

  const retry = useCallback(() => {
    setRetryToken((n) => n + 1);
  }, []);

  // Fetch primary lyrics whenever enabled and track identity changes (or on explicit retry)
  useEffect(() => {
    if (!enabled || !trackKey) {
      setStatus("idle");
      setDoc(null);
      setIsEnriching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const bypassCache = retryToken > 0;

    setStatus("loading");
    setIsEnriching(false);

    void fetchLyricsForTrack(
      {
        track: query.track,
        artist: query.artist,
        album: query.album,
        duration: query.duration,
        sourceName: query.sourceName,
      },
      { bypassCache, signal: controller.signal },
    )
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setDoc(applyOfflineRomanizationToDoc(result));
        setStatus("ready");
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[Lyrics] Resolution error:", error);
        setDoc(null);
        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [
    enabled,
    trackKey,
    retryToken,
    query.track,
    query.artist,
    query.album,
    query.duration,
    query.sourceName,
  ]);

  const hasNonLatin = useMemo(() => {
    if (!doc) return false;
    if (typeof doc.hasNonLatinScript === "boolean") return doc.hasNonLatinScript;
    return hasNonLatinScript(doc.lines);
  }, [doc]);

  const normalizedTarget = normalizeLangCode(targetLang);

  // On-demand per-line network enrichment for Kanji/Chinese/Arabic/etc. romanization
  // or target-language translations. Never mutates word timestamps or resets rAF sync.
  useEffect(() => {
    if (!enabled || status !== "ready" || !doc || doc.lines.length === 0) {
      setIsEnriching(false);
      return;
    }
    if (!romanized && !translated) {
      setIsEnriching(false);
      return;
    }

    const needsNetworkRomanized =
      romanized &&
      hasNonLatin &&
      doc.lines.some((line) => hasNonLatinScript(line.text) && !line.romanized);

    const alreadySameLang =
      Boolean(doc.sourceLang) &&
      normalizeLangCode(doc.sourceLang) === normalizedTarget;

    const needsTranslated =
      translated &&
      !alreadySameLang &&
      doc.lines.some((line) => !line.translations?.[normalizedTarget]);

    if (!needsNetworkRomanized && !needsTranslated) {
      setIsEnriching(false);
      return;
    }

    const enrichId = ++enrichIdRef.current;
    const controller = new AbortController();
    setIsEnriching(true);

    void enrichLyricsForTrack(doc, targetLang, { signal: controller.signal })
      .then((enriched) => {
        if (enrichIdRef.current !== enrichId) return;
        setIsEnriching(false);
        if (!enriched) return;

        setDoc((prev) => {
          if (!prev || prev.trackKey !== doc.trackKey) return prev;
          const detectedSource = enriched.sourceLang || prev.sourceLang;
          const isSameLang =
            Boolean(detectedSource) &&
            normalizeLangCode(detectedSource) === normalizedTarget;

          const mergedLines = prev.lines.map((line, idx) => {
            const candidateRom = enriched.romanizedLines[idx]?.trim();
            const nextRom =
              line.romanized ||
              (hasNonLatin && isSaneRomanization(line.text, candidateRom)
                ? candidateRom
                : undefined);

            const nextRomWords =
              line.romanizedWords ||
              (!line.romanizedTimedWords && nextRom && line.words && line.words.length > 0
                ? alignRomanizedWords(line.words, nextRom) ?? undefined
                : undefined);

            const rawTr = enriched.translatedLines[idx]?.trim();
            const existingTr = line.translations?.[normalizedTarget];
            const nextTrValue =
              existingTr ||
              (!isSameLang && rawTr && rawTr.toLowerCase() !== line.text.trim().toLowerCase()
                ? rawTr
                : undefined);

            const nextTranslations = nextTrValue
              ? { ...(line.translations ?? {}), [normalizedTarget]: nextTrValue }
              : line.translations;

            if (
              nextRom === line.romanized &&
              nextRomWords === line.romanizedWords &&
              nextTranslations === line.translations
            ) {
              return line;
            }
            return {
              ...line,
              romanized: nextRom,
              romanizedWords: nextRomWords,
              translations: nextTranslations,
            };
          });

          return {
            ...prev,
            sourceLang: detectedSource,
            hasNonLatinScript: hasNonLatin,
            lines: mergedLines,
          };
        });
        setEnrichmentNonce((n) => n + 1);
      })
      .catch((error) => {
        if (enrichIdRef.current !== enrichId) return;
        setIsEnriching(false);
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => {
      controller.abort();
    };
  }, [
    enabled,
    status,
    doc?.trackKey,
    romanized,
    translated,
    targetLang,
    normalizedTarget,
    hasNonLatin,
  ]);

  const isSameAsTargetLang = Boolean(
    doc?.sourceLang && normalizeLangCode(doc.sourceLang) === normalizedTarget,
  );

  return {
    status,
    document: doc,
    trackKey,
    isEnriching,
    hasNonLatin,
    isSameAsTargetLang,
    enrichmentNonce,
    retry,
  };
}
