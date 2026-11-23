// src/hooks/useLyricsSync.ts
// 60fps imperative sync loop for word-by-word karaoke sweep (including native
// Apple Music syllable-timed romanization words), 3-dot instrumental interlude
// progress, and active-line tracking.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { findActiveLyricPosition } from "../lib/lyrics/parsers";
import type { LyricLine, LyricWord } from "../lib/lyrics/types";
import { useVinylDeckStore } from "../lib/playback/store";

export interface UseLyricsSyncOptions {
  lines: LyricLine[];
  isWordSynced: boolean;
  useRomanizedWords: boolean;
  isPlaying: boolean;
  enabled: boolean;
  /** Map from `${lineIndex}:${wordIndex}` -> word DOM span element. */
  wordRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>;
  /** Map from `lineIndex` -> interlude 3-dot container element. */
  interludeRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

function getActiveWordsForLine(
  line: LyricLine | undefined,
  useRomanizedWords: boolean,
): LyricWord[] | undefined {
  if (!line) return undefined;
  if (useRomanizedWords && line.romanizedTimedWords && line.romanizedTimedWords.length > 0) {
    return line.romanizedTimedWords;
  }
  return line.words;
}

function setWordVisual(
  el: HTMLSpanElement,
  state: "upcoming" | "active" | "past",
  progressStr: string,
) {
  if (el.dataset.wordProg !== progressStr) {
    el.dataset.wordProg = progressStr;
    el.style.setProperty("--word-progress", progressStr);
  }
  if (el.dataset.wordState !== state) {
    el.dataset.wordState = state;
  }
}

function paintLineWordSweep(
  lines: LyricLine[],
  wordRefs: Map<string, HTMLSpanElement>,
  lineIdx: number,
  timeMs: number,
  useRomanizedWords: boolean,
) {
  const words = getActiveWordsForLine(lines[lineIdx], useRomanizedWords);
  if (!words || words.length === 0) return;

  for (let w = 0; w < words.length; w++) {
    const el = wordRefs.get(`${lineIdx}:${w}`);
    if (!el) continue;
    const word = words[w];

    if (timeMs < word.startMs) {
      setWordVisual(el, "upcoming", "0%");
    } else if (timeMs >= word.endMs) {
      setWordVisual(el, "past", "100%");
    } else {
      const span = Math.max(1, word.endMs - word.startMs);
      const rawPct = Math.min(100, Math.max(0, ((timeMs - word.startMs) / span) * 100));
      const quantized = Math.round(rawPct * 2) / 2;
      setWordVisual(el, "active", `${quantized}%`);
    }
  }
}

function paintInterludeDots(
  el: HTMLDivElement | undefined,
  progress: number,
) {
  if (!el) return;
  const clamped = Math.min(1, Math.max(0, progress));
  for (let i = 0; i < 3; i++) {
    const start = i / 3;
    const local = Math.min(1, Math.max(0, (clamped - start) * 3));
    const quantized = (Math.round(local * 50) / 50).toFixed(2);
    const key = `dot${i}` as const;
    if (el.dataset[key] !== quantized) {
      el.dataset[key] = quantized;
      el.style.setProperty(`--dot-${i}`, quantized);
    }
  }
}

export function useLyricsSync({
  lines,
  isWordSynced,
  useRomanizedWords,
  isPlaying,
  enabled,
  wordRefs,
  interludeRefs,
}: UseLyricsSyncOptions): number {
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const activeLineRef = useRef<number>(-1);
  const lastPaintedLineRef = useRef<number>(-1);

  const trackIdentity = lines.length > 0 ? `${lines[0].id}:${lines.length}` : "";
  useEffect(() => {
    activeLineRef.current = -1;
    lastPaintedLineRef.current = -1;
    setActiveLineIndex(-1);
  }, [trackIdentity]);

  useLayoutEffect(() => {
    if (!enabled || activeLineIndex < 0) return;
    const store = useVinylDeckStore.getState();
    const timeMs = (store.devForceEmpty ? 0 : store.getPosition()) * 1000;
    const line = lines[activeLineIndex];
    if (line?.isInterlude) {
      const span = Math.max(1, line.endMs - line.startMs);
      paintInterludeDots(
        interludeRefs.current.get(activeLineIndex),
        (timeMs - line.startMs) / span,
      );
    } else if (isWordSynced) {
      paintLineWordSweep(
        lines,
        wordRefs.current,
        activeLineIndex,
        timeMs,
        useRomanizedWords,
      );
    }
  }, [activeLineIndex, lines, isWordSynced, useRomanizedWords, enabled, wordRefs, interludeRefs]);

  useEffect(() => {
    if (!enabled || lines.length === 0) return;

    let rafId = 0;

    function resetLineVisuals(lineIdx: number, state: "past" | "upcoming") {
      const line = lines[lineIdx];
      if (!line) return;
      if (line.isInterlude) {
        paintInterludeDots(
          interludeRefs.current.get(lineIdx),
          state === "past" ? 1 : 0,
        );
        return;
      }
      const words = getActiveWordsForLine(line, useRomanizedWords);
      if (!isWordSynced || !words) return;
      const fill = state === "past" ? "100%" : "0%";
      for (let w = 0; w < words.length; w++) {
        const el = wordRefs.current.get(`${lineIdx}:${w}`);
        if (!el) continue;
        setWordVisual(el, state, fill);
      }
    }

    function syncFrame() {
      const store = useVinylDeckStore.getState();
      const timeMs = (store.devForceEmpty ? 0 : store.getPosition()) * 1000;
      const { lineIndex, wordProgress } = findActiveLyricPosition(lines, timeMs);

      if (lineIndex !== activeLineRef.current) {
        const prevLine = activeLineRef.current;
        activeLineRef.current = lineIndex;
        setActiveLineIndex(lineIndex);

        if (prevLine >= 0 && prevLine !== lineIndex) {
          resetLineVisuals(prevLine, prevLine < lineIndex ? "past" : "upcoming");
        }
      }

      if (lastPaintedLineRef.current >= 0 && lastPaintedLineRef.current !== lineIndex) {
        resetLineVisuals(
          lastPaintedLineRef.current,
          lastPaintedLineRef.current < lineIndex ? "past" : "upcoming",
        );
      }

      if (lineIndex >= 0) {
        const current = lines[lineIndex];
        if (current?.isInterlude) {
          paintInterludeDots(interludeRefs.current.get(lineIndex), wordProgress);
        } else if (isWordSynced) {
          paintLineWordSweep(
            lines,
            wordRefs.current,
            lineIndex,
            timeMs,
            useRomanizedWords,
          );
        }
      }
      lastPaintedLineRef.current = lineIndex;

      if (isPlaying) {
        rafId = window.requestAnimationFrame(syncFrame);
      }
    }

    syncFrame();

    let unsubscribeStore: (() => void) | undefined;
    if (!isPlaying) {
      unsubscribeStore = useVinylDeckStore.subscribe(
        (s) => `${s.lastKnownPosition}:${s.pendingSeekPosition ?? "none"}`,
        () => {
          syncFrame();
        },
      );
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (unsubscribeStore) unsubscribeStore();
    };
  }, [lines, isWordSynced, useRomanizedWords, isPlaying, enabled, wordRefs, interludeRefs]);

  return activeLineIndex;
}
