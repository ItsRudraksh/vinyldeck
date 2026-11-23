// src/components/LyricsStage/index.tsx
// Realtime word-by-word and line-synced lyrics stage supporting Split View
// (left or right side) and Compact Strip layouts, customizable font family &
// size, damped-spring scroll choreography on the 44% optical axis, zero-flicker
// 2-layer karaoke sweep, native Apple Music syllable-timed romaji, 3-dot
// instrumental interludes, tucked background vocals, and click-to-seek.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLyricsSync } from "../../hooks/useLyricsSync";
import type { LyricsStatus } from "../../hooks/useLyrics";
import {
  buildDisplayLinesWithInterludes,
  formatTimestampMs,
} from "../../lib/lyrics/parsers";
import {
  LYRICS_FONT_FAMILY_META,
  LYRICS_TARGET_LANG_LABELS,
  type LyricLine,
  type LyricsDocument,
  type LyricsFontFamily,
  type LyricsFontSize,
  type LyricsLayout,
  type LyricsTargetLang,
} from "../../lib/lyrics/types";
import { Kbd } from "../Kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import "./LyricsStage.css";

interface LyricsStageProps {
  layout: LyricsLayout;
  fontFamily: LyricsFontFamily;
  fontSize: LyricsFontSize;
  status: LyricsStatus;
  document: LyricsDocument | null;
  isPlaying: boolean;
  isIdle: boolean;
  canSeek: boolean;
  duration: number;
  showRomanized: boolean;
  showTranslated: boolean;
  targetLang: LyricsTargetLang;
  hasNonLatin: boolean;
  isSameAsTargetLang: boolean;
  isEnriching: boolean;
  enrichmentNonce: number;
  onSeek: (seconds: number) => void;
  onLayoutChange: (layout: LyricsLayout) => void;
  onToggleRomanized: () => void;
  onToggleTranslated: () => void;
  onRetry: () => void;
}

const MANUAL_SCROLL_RESUME_MS = 4000;

// Optical focal axis in Split View (44% from top aligns cleanly with the turntable's center)
const SPLIT_FOCAL_RATIO = 0.44;

// Damped spring constants for fluid, Apple-Music-style lyric scroll glide
const SPRING_STIFFNESS = 140;
const SPRING_DAMPING = 22.5;
const SPRING_SETTLE_POS_EPS = 0.35;
const SPRING_SETTLE_VEL_EPS = 0.5;

interface SpringScrollState {
  rafId: number;
  position: number;
  velocity: number;
  target: number;
  lastTs: number;
  active: boolean;
}

export function LyricsStage({
  layout,
  fontFamily,
  fontSize,
  status,
  document,
  isPlaying,
  isIdle,
  canSeek,
  duration,
  showRomanized,
  showTranslated,
  targetLang,
  hasNonLatin,
  isSameAsTargetLang,
  isEnriching,
  enrichmentNonce,
  onSeek,
  onLayoutChange,
  onToggleRomanized,
  onToggleTranslated,
  onRetry,
}: LyricsStageProps) {
  const lines = useMemo(
    () => buildDisplayLinesWithInterludes(document?.lines ?? []),
    [document],
  );
  const isWordSynced = document?.kind === "word";
  const isTimed = document?.kind === "word" || document?.kind === "line";
  const useRomanizedWords = Boolean(showRomanized && hasNonLatin);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLElement>>(new Map());
  const wordRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const interludeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const manualScrollTimerRef = useRef<number | null>(null);
  const springRef = useRef<SpringScrollState>({
    rafId: 0,
    position: 0,
    velocity: 0,
    target: 0,
    lastTs: 0,
    active: false,
  });

  const [userScrolling, setUserScrolling] = useState<boolean>(false);

  const activeLineIndex = useLyricsSync({
    lines,
    isWordSynced,
    useRomanizedWords,
    isPlaying,
    enabled: isTimed && lines.length > 0,
    wordRefs,
    interludeRefs,
  });

  const stopSpringScroll = useCallback(() => {
    const spring = springRef.current;
    if (spring.rafId) {
      window.cancelAnimationFrame(spring.rafId);
      spring.rafId = 0;
    }
    spring.active = false;
    spring.velocity = 0;
    spring.lastTs = 0;
  }, []);

  // Clear stale refs and reset scroll on track document swap
  useEffect(() => {
    stopSpringScroll();
    setUserScrolling(false);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
      manualScrollTimerRef.current = null;
    }
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = 0;
      springRef.current.position = 0;
      springRef.current.target = 0;
    }
  }, [document?.trackKey, stopSpringScroll]);

  // Compute exact optical-axis target using getBoundingClientRect() deltas
  // and drive scrollTop via a continuous damped-spring physics loop.
  const scrollToLine = useCallback(
    (lineIdx: number, instant = false) => {
      if (layout !== "split") return;
      const container = scrollContainerRef.current;
      const lineEl = lineRefs.current.get(lineIdx);
      if (!container || !lineEl) return;

      const containerRect = container.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      if (containerRect.height <= 0) return;

      const lineCenterY = lineRect.top + lineRect.height * 0.5;
      const viewportFocalY = containerRect.top + containerRect.height * SPLIT_FOCAL_RATIO;
      const deltaY = lineCenterY - viewportFocalY;
      const rawTarget = container.scrollTop + deltaY;
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const clampedTarget = Math.max(0, Math.min(rawTarget, maxScroll));

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (instant || prefersReducedMotion) {
        stopSpringScroll();
        container.scrollTop = clampedTarget;
        springRef.current.position = clampedTarget;
        springRef.current.target = clampedTarget;
        return;
      }

      const spring = springRef.current;
      if (!spring.active) {
        spring.position = container.scrollTop;
        spring.velocity = 0;
        spring.lastTs = 0;
      }
      spring.target = clampedTarget;

      if (spring.active) return;
      spring.active = true;

      const step = (ts: number) => {
        const el = scrollContainerRef.current;
        if (!el || !spring.active) {
          stopSpringScroll();
          return;
        }

        if (spring.lastTs === 0) {
          spring.lastTs = ts;
          spring.rafId = window.requestAnimationFrame(step);
          return;
        }

        const dt = Math.min(0.032, Math.max(0.001, (ts - spring.lastTs) / 1000));
        spring.lastTs = ts;

        const displacement = spring.position - spring.target;
        const accel =
          -SPRING_STIFFNESS * displacement - SPRING_DAMPING * spring.velocity;
        spring.velocity += accel * dt;
        spring.position += spring.velocity * dt;

        const maxNow = Math.max(0, el.scrollHeight - el.clientHeight);
        const clampedPos = Math.max(0, Math.min(spring.position, maxNow));
        el.scrollTop = clampedPos;

        if (
          Math.abs(spring.position - spring.target) < SPRING_SETTLE_POS_EPS &&
          Math.abs(spring.velocity) < SPRING_SETTLE_VEL_EPS
        ) {
          el.scrollTop = Math.max(0, Math.min(spring.target, maxNow));
          stopSpringScroll();
          return;
        }

        spring.rafId = window.requestAnimationFrame(step);
      };

      spring.rafId = window.requestAnimationFrame(step);
    },
    [layout, stopSpringScroll],
  );

  // Auto-scroll active line onto the optical center axis in Split View
  useEffect(() => {
    if (layout !== "split" || userScrolling || activeLineIndex < 0) return;
    scrollToLine(activeLineIndex);
  }, [activeLineIndex, layout, userScrolling, scrollToLine]);

  // Re-center smoothly when idle state, typography, language aids, or enrichment change
  useEffect(() => {
    if (layout !== "split" || userScrolling || activeLineIndex < 0) return;
    const rafId = window.requestAnimationFrame(() => {
      scrollToLine(activeLineIndex);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    isIdle,
    fontFamily,
    fontSize,
    showRomanized,
    showTranslated,
    targetLang,
    enrichmentNonce,
    layout,
    userScrolling,
    activeLineIndex,
    scrollToLine,
  ]);

  // Re-center cleanly when the scroll viewport resizes (window resize, mode morph)
  useEffect(() => {
    if (layout !== "split") return;
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (userScrolling || activeLineIndex < 0) return;
      scrollToLine(activeLineIndex);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout, userScrolling, activeLineIndex, scrollToLine]);

  const handleManualScrollIntent = useCallback(() => {
    stopSpringScroll();
    setUserScrolling(true);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
    manualScrollTimerRef.current = window.setTimeout(() => {
      setUserScrolling(false);
      manualScrollTimerRef.current = null;
    }, MANUAL_SCROLL_RESUME_MS);
  }, [stopSpringScroll]);

  useEffect(() => {
    return () => {
      stopSpringScroll();
      if (manualScrollTimerRef.current !== null) {
        window.clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, [stopSpringScroll]);

  function handleRecenter() {
    setUserScrolling(false);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
      manualScrollTimerRef.current = null;
    }
    if (activeLineIndex >= 0) {
      scrollToLine(activeLineIndex);
    }
  }

  function handleLineClick(
    line: LyricLine,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (event.detail > 0) {
      event.currentTarget.blur();
    }
    if (!canSeek || !isTimed || line.isInterlude) return;
    const rawTarget = line.startMs / 1000;
    const maxSec = duration > 0 ? duration : Math.max(rawTarget, 0);
    const targetSec = Math.min(maxSec, Math.max(0, rawTarget));
    setUserScrolling(false);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
      manualScrollTimerRef.current = null;
    }
    onSeek(targetSec);
  }

  function registerWordRef(
    lineIdx: number,
    wordIdx: number,
    el: HTMLSpanElement | null,
  ) {
    const key = `${lineIdx}:${wordIdx}`;
    if (el) {
      wordRefs.current.set(key, el);
    } else {
      wordRefs.current.delete(key);
    }
  }

  function renderTranslation(line: LyricLine, isActive: boolean, inStrip: boolean) {
    if (inStrip && !isActive) return null;

    const translatedText =
      showTranslated && !isSameAsTargetLang
        ? line.translations?.[targetLang] ?? null
        : null;

    if (!translatedText) return null;

    return (
      <span
        className={`lyrics-subtitles${isActive ? " lyrics-subtitles--active" : ""}`}
      >
        <span className="lyrics-subtitle lyrics-subtitle--translated">
          {translatedText}
        </span>
      </span>
    );
  }

  function renderInterludeDots(lineIdx: number, isActive: boolean) {
    return (
      <div
        ref={(el) => {
          if (el) interludeRefs.current.set(lineIdx, el);
          else interludeRefs.current.delete(lineIdx);
        }}
        className={`lyrics-interlude__dots${isActive ? " lyrics-interlude__dots--active" : ""}`}
        aria-hidden="true"
      >
        <span className="lyrics-interlude__dot lyrics-interlude__dot--0" />
        <span className="lyrics-interlude__dot lyrics-interlude__dot--1" />
        <span className="lyrics-interlude__dot lyrics-interlude__dot--2" />
      </div>
    );
  }

  function renderLineContent(
    line: LyricLine,
    lineIdx: number,
    isActive: boolean,
    inStrip: boolean,
  ) {
    if (line.isInterlude) {
      return renderInterludeDots(lineIdx, isActive);
    }

    const useRom = Boolean(
      showRomanized &&
        hasNonLatin &&
        (line.romanized || line.romanizedWords || line.romanizedTimedWords),
    );
    const primaryDisplayText = useRom ? line.romanized || line.text : line.text;

    // Prefer native Apple Music syllable-timed romanized words when available
    const hasNativeTimedRom = Boolean(
      useRom && line.romanizedTimedWords && line.romanizedTimedWords.length > 0,
    );
    const hasAlignedRom = Boolean(
      useRom &&
        line.words &&
        line.romanizedWords &&
        line.romanizedWords.length === line.words.length,
    );

    const activeWordsList = hasNativeTimedRom
      ? line.romanizedTimedWords
      : line.words;

    // Render identical word-span structure for BOTH inactive and active lines
    // on word-synced tracks so line wrapping, spacing, and background-vocal
    // sizing NEVER shift or reflow when a line becomes active. Only mount the
    // lit karaoke overlay (.lyrics-word__fill) on the active line for zero
    // extra compositor cost on inactive lines.
    const canRenderWordSpans =
      isWordSynced &&
      Boolean(activeWordsList && activeWordsList.length > 0) &&
      (!useRom || hasNativeTimedRom || hasAlignedRom);

    const renderWordToken = (word: NonNullable<typeof activeWordsList>[number], wIdx: number) => {
      const wordText =
        useRom && !hasNativeTimedRom
          ? (line.romanizedWords?.[wIdx] ?? "")
          : word.text;
      if (!wordText) return null;
      return (
        <span
          key={`${line.id}-w-${wIdx}-${useRom ? "rom" : "orig"}`}
          ref={isActive ? (el) => registerWordRef(lineIdx, wIdx, el) : undefined}
          className="lyrics-word"
          data-word-state={isActive ? "upcoming" : undefined}
        >
          <span className="lyrics-word__base">{wordText}</span>
          {isActive && (
            <span className="lyrics-word__fill" aria-hidden="true">
              {wordText}
            </span>
          )}
        </span>
      );
    };

    let primary: ReactNode;
    if (canRenderWordSpans && activeWordsList) {
      const leadEntries: Array<{ word: (typeof activeWordsList)[number]; idx: number }> = [];
      const bgEntries: Array<{ word: (typeof activeWordsList)[number]; idx: number }> = [];
      for (let wIdx = 0; wIdx < activeWordsList.length; wIdx++) {
        const w = activeWordsList[wIdx];
        if (w.isBackground && !line.isBackground) {
          bgEntries.push({ word: w, idx: wIdx });
        } else {
          leadEntries.push({ word: w, idx: wIdx });
        }
      }

      primary = (
        <>
          {leadEntries.length > 0 && (
            <span className="lyrics-line__words lyrics-line__lead">
              {leadEntries.map(({ word, idx }) => renderWordToken(word, idx))}
            </span>
          )}
          {bgEntries.length > 0 && (
            <span className="lyrics-line__words lyrics-line__bg">
              {bgEntries.map(({ word, idx }) => renderWordToken(word, idx))}
            </span>
          )}
        </>
      );
    } else {
      primary = <span className="lyrics-line__text">{primaryDisplayText}</span>;
    }

    return (
      <>
        {primary}
        {renderTranslation(line, isActive, inStrip)}
      </>
    );
  }

  const stripIndices = useMemo(() => {
    if (lines.length === 0) return [];
    const center = activeLineIndex < 0 ? 0 : activeLineIndex;
    const result: Array<{ idx: number; role: "prev" | "active" | "next" }> = [];
    if (center > 0) result.push({ idx: center - 1, role: "prev" });
    result.push({ idx: center, role: activeLineIndex < 0 ? "next" : "active" });
    if (center + 1 < lines.length) {
      result.push({ idx: center + 1, role: "next" });
    }
    return result;
  }, [lines.length, activeLineIndex]);

  const showUtilityBar =
    status !== "idle" &&
    document?.kind !== "instrumental" &&
    document?.kind !== "not_found";

  const targetLangLabel = LYRICS_TARGET_LANG_LABELS[targetLang] ?? "English";
  const fontStack =
    LYRICS_FONT_FAMILY_META[fontFamily]?.stack ??
    LYRICS_FONT_FAMILY_META.display.stack;

  const romTooltipText = !hasNonLatin
    ? "Already in Latin script"
    : showRomanized
      ? "Show original script"
      : "Romanize lyrics";

  const trTooltipText = isSameAsTargetLang
    ? `Already in ${targetLangLabel}`
    : showTranslated
      ? "Hide translation"
      : `Translate to ${targetLangLabel}`;

  return (
    <section
      className={`lyrics-stage lyrics-stage--${layout}${isIdle ? " lyrics-stage--idle" : ""}`}
      style={{ "--lyrics-font-family": fontStack } as CSSProperties}
      aria-label="Realtime lyrics"
      data-testid="lyrics-stage"
      data-layout={layout}
      data-font={fontFamily}
      data-size={fontSize}
      data-lyrics-kind={document?.kind ?? status}
    >
      {/* ── Body ─────────────────────────────────────────────── */}
      {status === "loading" ? (
        <div
          className="lyrics-state lyrics-state--loading"
          role="status"
          aria-live="polite"
          aria-label="Loading lyrics"
        >
          <span className="lyrics-skeleton lyrics-skeleton--wide" />
          <span className="lyrics-skeleton lyrics-skeleton--mid" />
          <span className="lyrics-skeleton lyrics-skeleton--short" />
        </div>
      ) : status === "error" ? (
        <div className="lyrics-state" role="status">
          <p className="lyrics-state__title">Couldn&rsquo;t load lyrics</p>
          <p className="lyrics-state__hint">
            Check your connection and try again.
          </p>
          <button
            type="button"
            className="lyrics-action-btn"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      ) : document?.kind === "plain" ? (
        <div className="lyrics-plain-wrap">
          <p className="lyrics-plain__caption">Unsynced lyrics</p>
          <div className="lyrics-plain__scroll">
            {(document.plainText || "").split(/\r?\n/).map((row, idx) => (
              <p key={idx} className="lyrics-plain__line">
                {row || "\u00A0"}
              </p>
            ))}
          </div>
        </div>
      ) : layout === "split" ? (
        <div className="lyrics-split-wrap">
          <div
            ref={scrollContainerRef}
            className="lyrics-scroll"
            data-user-scrolling={userScrolling ? "true" : "false"}
            onWheel={handleManualScrollIntent}
            onTouchMove={handleManualScrollIntent}
          >
            <div
              className="lyrics-scroll__spacer lyrics-scroll__spacer--top"
              aria-hidden="true"
            />
            {lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = activeLineIndex >= 0 && idx < activeLineIndex;
              const distance =
                activeLineIndex >= 0 ? Math.abs(idx - activeLineIndex) : idx;
              const clampedDistance = Math.min(distance, 4);
              const staggerMs = isActive ? 0 : Math.min(clampedDistance * 22, 88);

              if (line.isInterlude) {
                return (
                  <div
                    key={line.id}
                    ref={(el) => {
                      if (el) lineRefs.current.set(idx, el);
                      else lineRefs.current.delete(idx);
                    }}
                    className={[
                      "lyrics-interlude",
                      isActive ? "lyrics-interlude--active" : "",
                      isPast ? "lyrics-interlude--past" : "lyrics-interlude--upcoming",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden={!isActive}
                  >
                    {renderInterludeDots(idx, isActive)}
                  </div>
                );
              }

              const accessibleText =
                showRomanized && hasNonLatin && line.romanized
                  ? line.romanized
                  : line.text;

              return (
                <button
                  key={line.id}
                  ref={(el) => {
                    if (el) lineRefs.current.set(idx, el);
                    else lineRefs.current.delete(idx);
                  }}
                  type="button"
                  disabled={!canSeek}
                  className={[
                    "lyrics-line",
                    isActive ? "lyrics-line--active" : "",
                    isPast ? "lyrics-line--past" : "lyrics-line--upcoming",
                    !isWordSynced && isActive ? "lyrics-line--line-sync" : "",
                    line.singer === "secondary" ? "lyrics-line--secondary" : "",
                    line.isBackground ? "lyrics-line--background" : "",
                    canSeek ? "lyrics-line--seekable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--line-stagger": `${staggerMs}ms` } as CSSProperties}
                  data-distance={clampedDistance}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={
                    canSeek
                      ? `Seek to ${formatTimestampMs(line.startMs)}: ${accessibleText}`
                      : accessibleText
                  }
                  onClick={(event) => handleLineClick(line, event)}
                >
                  <span className="lyrics-line__body">
                    {renderLineContent(line, idx, isActive, false)}
                  </span>
                  {canSeek && (
                    <span className="lyrics-line__time" aria-hidden="true">
                      {formatTimestampMs(line.startMs)}
                    </span>
                  )}
                </button>
              );
            })}
            <div
              className="lyrics-scroll__spacer lyrics-scroll__spacer--bottom"
              aria-hidden="true"
            />
          </div>

          <AnimatePresence>
            {userScrolling && !isIdle && (
              <motion.div
                className="lyrics-recenter-wrap"
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Tooltip side="top">
                  <TooltipTrigger>
                    <button
                      type="button"
                      className="lyrics-recenter"
                      onClick={handleRecenter}
                    >
                      Recenter
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Return to active lyric</TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Compact Strip (2–3 line focused stage with fluid spring glide) ── */
        <div className="lyrics-strip" aria-live="off">
          <AnimatePresence mode="popLayout" initial={false}>
            {stripIndices.map(({ idx, role }) => {
              const line = lines[idx];
              if (!line) return null;
              const isActive = role === "active";

              if (line.isInterlude) {
                return (
                  <motion.div
                    key={line.id}
                    layout="position"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: isActive ? 1 : 0.35, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className={`lyrics-strip__interlude${isActive ? " lyrics-interlude--active" : ""}`}
                  >
                    {renderInterludeDots(idx, isActive)}
                  </motion.div>
                );
              }

              const accessibleText =
                showRomanized && hasNonLatin && line.romanized
                  ? line.romanized
                  : line.text;

              return (
                <motion.button
                  key={line.id}
                  layout="position"
                  type="button"
                  disabled={!canSeek}
                  initial={{
                    opacity: 0,
                    y: role === "prev" ? -12 : 14,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: isActive ? 1 : role === "prev" ? 0.48 : 0.62,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: role === "prev" ? -14 : 12,
                    scale: 0.96,
                  }}
                  transition={{
                    layout: { type: "spring", stiffness: 260, damping: 28 },
                    opacity: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                    y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                    scale: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
                  }}
                  className={[
                    "lyrics-strip__line",
                    `lyrics-strip__line--${role}`,
                    !isWordSynced && isActive ? "lyrics-line--line-sync" : "",
                    line.isBackground ? "lyrics-line--background" : "",
                    canSeek ? "lyrics-line--seekable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={
                    canSeek
                      ? `Seek to ${formatTimestampMs(line.startMs)}: ${accessibleText}`
                      : accessibleText
                  }
                  onClick={(event) => handleLineClick(line, event)}
                >
                  {renderLineContent(line, idx, isActive, true)}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Ghostly Utility Strip (fades out on Lean-Back idle) ── */}
      {showUtilityBar && (
        <div
          className={`lyrics-utility${isIdle ? " lyrics-utility--hidden" : ""}`}
          role="toolbar"
          aria-label="Lyrics controls"
        >
          <div className="lyrics-utility__group" role="group" aria-label="Lyrics layout">
            <Tooltip side="top">
              <TooltipTrigger>
                <button
                  type="button"
                  className={`lyrics-utility__btn${layout === "split" ? " lyrics-utility__btn--active" : ""}`}
                  aria-pressed={layout === "split"}
                  onClick={() => onLayoutChange("split")}
                >
                  Split
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Split View <Kbd>Shift L</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip side="top">
              <TooltipTrigger>
                <button
                  type="button"
                  className={`lyrics-utility__btn${layout === "strip" ? " lyrics-utility__btn--active" : ""}`}
                  aria-pressed={layout === "strip"}
                  onClick={() => onLayoutChange("strip")}
                >
                  Strip
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Compact Strip <Kbd>Shift L</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          {isTimed && (
            <>
              <span className="lyrics-utility__sep" aria-hidden="true">
                ·
              </span>
              <div
                className="lyrics-utility__group"
                role="group"
                aria-label="Lyrics language aids"
              >
                <Tooltip side="top">
                  <TooltipTrigger>
                    <button
                      type="button"
                      className={[
                        "lyrics-utility__btn",
                        showRomanized && hasNonLatin
                          ? "lyrics-utility__btn--active"
                          : "",
                        !hasNonLatin ? "lyrics-utility__btn--muted" : "",
                        isEnriching && showRomanized && hasNonLatin
                          ? "lyrics-utility__btn--loading"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={showRomanized}
                      aria-label={romTooltipText}
                      onClick={onToggleRomanized}
                    >
                      Rom
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {romTooltipText} {hasNonLatin ? <Kbd>R</Kbd> : null}
                  </TooltipContent>
                </Tooltip>

                <Tooltip side="top">
                  <TooltipTrigger>
                    <button
                      type="button"
                      className={[
                        "lyrics-utility__btn",
                        showTranslated && !isSameAsTargetLang
                          ? "lyrics-utility__btn--active"
                          : "",
                        isSameAsTargetLang ? "lyrics-utility__btn--muted" : "",
                        isEnriching && showTranslated && !isSameAsTargetLang
                          ? "lyrics-utility__btn--loading"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={showTranslated}
                      aria-label={trTooltipText}
                      onClick={onToggleTranslated}
                    >
                      Tr
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {trTooltipText}{" "}
                    {!isSameAsTargetLang ? <Kbd>Shift T</Kbd> : null}
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
