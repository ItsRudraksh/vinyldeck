// src/lib/lyrics/demoLyrics.ts
// Deterministic word-synced, line-synced, and instrumental lyrics for built-in
// MockSource preview tracks so every lyrics mode can be experienced offline or
// in sandbox previews without rate-limit flakiness.

import { buildTrackKey } from "./parsers";
import type { LyricLine, LyricWord, LyricsDocument } from "./types";

interface WordSpec {
  text: string;
  durMs: number;
}

function buildTimedLine(
  id: string,
  startMs: number,
  specs: WordSpec[],
  options?: { singer?: "primary" | "secondary"; isBackground?: boolean },
): LyricLine {
  let cursor = startMs;
  const words: LyricWord[] = specs.map((spec, idx) => {
    const wStart = cursor;
    const wEnd = cursor + spec.durMs;
    cursor = wEnd;
    const needsSpace = idx < specs.length - 1 && !/\s$/.test(spec.text);
    return {
      text: needsSpace ? `${spec.text} ` : spec.text,
      startMs: wStart,
      endMs: wEnd,
      isBackground: options?.isBackground,
    };
  });

  return {
    id,
    startMs,
    endMs: cursor,
    text: specs.map((s) => s.text).join(" "),
    words,
    singer: options?.singer,
    isBackground: options?.isBackground,
  };
}

function buildWeOnGoLyrics(trackKey: string): LyricsDocument {
  const lines: LyricLine[] = [
    buildTimedLine("wog-0", 400, [
      { text: "Midnight", durMs: 520 },
      { text: "needle", durMs: 420 },
      { text: "drops", durMs: 380 },
      { text: "into", durMs: 340 },
      { text: "the", durMs: 220 },
      { text: "velvet", durMs: 540 },
      { text: "groove", durMs: 680 },
    ]),
    buildTimedLine("wog-1", 3900, [
      { text: "Golden", durMs: 480 },
      { text: "amber", durMs: 460 },
      { text: "glow", durMs: 420 },
      { text: "across", durMs: 440 },
      { text: "the", durMs: 220 },
      { text: "quiet", durMs: 480 },
      { text: "room", durMs: 740 },
    ]),
    buildTimedLine("wog-2", 7600, [
      { text: "Every", durMs: 400 },
      { text: "city", durMs: 380 },
      { text: "light", durMs: 440 },
      { text: "is", durMs: 240 },
      { text: "spinning", durMs: 540 },
      { text: "thirty-three", durMs: 680 },
    ]),
    buildTimedLine(
      "wog-3",
      10900,
      [
        { text: "(we", durMs: 340 },
        { text: "on", durMs: 300 },
        { text: "go,", durMs: 460 },
        { text: "never", durMs: 420 },
        { text: "slow)", durMs: 580 },
      ],
      { singer: "secondary", isBackground: true },
    ),
    buildTimedLine("wog-4", 13600, [
      { text: "Keep", durMs: 360 },
      { text: "the", durMs: 220 },
      { text: "platter", durMs: 460 },
      { text: "turning", durMs: 520 },
      { text: "while", durMs: 360 },
      { text: "the", durMs: 220 },
      { text: "shadows", durMs: 560 },
      { text: "move", durMs: 720 },
    ]),
    buildTimedLine("wog-5", 17600, [
      { text: "Static", durMs: 460 },
      { text: "in", durMs: 240 },
      { text: "the", durMs: 220 },
      { text: "air,", durMs: 460 },
      { text: "warmth", durMs: 480 },
      { text: "in", durMs: 240 },
      { text: "every", durMs: 420 },
      { text: "frame", durMs: 740 },
    ]),
    buildTimedLine(
      "wog-6",
      21500,
      [
        { text: "Hands", durMs: 420 },
        { text: "off", durMs: 320 },
        { text: "the", durMs: 220 },
        { text: "dial,", durMs: 520 },
        { text: "let", durMs: 320 },
        { text: "the", durMs: 220 },
        { text: "rhythm", durMs: 480 },
        { text: "stay", durMs: 760 },
      ],
      { singer: "secondary" },
    ),
    buildTimedLine("wog-7", 25400, [
      { text: "We", durMs: 320 },
      { text: "on", durMs: 300 },
      { text: "go", durMs: 480 },
      { text: "from", durMs: 320 },
      { text: "the", durMs: 220 },
      { text: "first", durMs: 420 },
      { text: "note", durMs: 480 },
      { text: "to", durMs: 240 },
      { text: "the", durMs: 220 },
      { text: "fade", durMs: 820 },
    ]),
    buildTimedLine("wog-8", 30000, [
      { text: "Silver", durMs: 480 },
      { text: "tonearm", durMs: 560 },
      { text: "tracing", durMs: 520 },
      { text: "through", durMs: 380 },
      { text: "the", durMs: 240 },
      { text: "dark", durMs: 780 },
    ]),
    buildTimedLine("wog-9", 33900, [
      { text: "Hold", durMs: 420 },
      { text: "that", durMs: 320 },
      { text: "tempo", durMs: 500 },
      { text: "steady", durMs: 520 },
      { text: "like", durMs: 320 },
      { text: "a", durMs: 200 },
      { text: "spark", durMs: 820 },
    ]),
    buildTimedLine("wog-10", 38000, [
      { text: "No", durMs: 360 },
      { text: "noise", durMs: 480 },
      { text: "in", durMs: 240 },
      { text: "the", durMs: 220 },
      { text: "signal,", durMs: 560 },
      { text: "only", durMs: 440 },
      { text: "sound", durMs: 480 },
      { text: "and", durMs: 260 },
      { text: "light", durMs: 860 },
    ]),
    buildTimedLine("wog-11", 43000, [
      { text: "Spinning", durMs: 540 },
      { text: "through", durMs: 380 },
      { text: "the", durMs: 240 },
      { text: "hours", durMs: 540 },
      { text: "of", durMs: 240 },
      { text: "the", durMs: 240 },
      { text: "night", durMs: 920 },
    ]),
  ];

  // Extend loop phrases smoothly across the 247s track so scrubbing anywhere works
  const basePeriodMs = 48000;
  const extended: LyricLine[] = [...lines];
  for (let repeat = 1; repeat <= 4; repeat++) {
    const shift = repeat * basePeriodMs;
    for (const line of lines) {
      if (line.startMs + shift >= 242000) break;
      extended.push({
        ...line,
        id: `${line.id}-r${repeat}`,
        startMs: line.startMs + shift,
        endMs: line.endMs + shift,
        words: line.words?.map((w) => ({
          ...w,
          startMs: w.startMs + shift,
          endMs: w.endMs + shift,
        })),
      });
    }
  }

  return {
    kind: "word",
    provider: "demo",
    lines: extended,
    trackKey,
  };
}

function buildTheRevengeLyrics(trackKey: string): LyricsDocument {
  const baseLines: LyricLine[] = [
    buildTimedLine("rev-0", 500, [
      { text: "Embers", durMs: 540 },
      { text: "rising", durMs: 520 },
      { text: "where", durMs: 360 },
      { text: "the", durMs: 240 },
      { text: "silence", durMs: 580 },
      { text: "broke", durMs: 740 },
    ]),
    buildTimedLine("rev-1", 4200, [
      { text: "Thunder", durMs: 520 },
      { text: "rolling", durMs: 500 },
      { text: "underneath", durMs: 680 },
      { text: "the", durMs: 240 },
      { text: "smoke", durMs: 780 },
    ]),
    buildTimedLine("rev-2", 8000, [
      { text: "Every", durMs: 420 },
      { text: "echo", durMs: 480 },
      { text: "carries", durMs: 520 },
      { text: "weight", durMs: 460 },
      { text: "and", durMs: 260 },
      { text: "flame", durMs: 820 },
    ]),
    buildTimedLine("rev-3", 12200, [
      { text: "Nothing", durMs: 480 },
      { text: "left", durMs: 380 },
      { text: "to", durMs: 240 },
      { text: "lose,", durMs: 520 },
      { text: "remember", durMs: 620 },
      { text: "every", durMs: 440 },
      { text: "name", durMs: 840 },
    ]),
    buildTimedLine("rev-4", 16800, [
      { text: "Steel", durMs: 460 },
      { text: "and", durMs: 260 },
      { text: "brass", durMs: 500 },
      { text: "begin", durMs: 460 },
      { text: "to", durMs: 240 },
      { text: "climb", durMs: 820 },
    ]),
    buildTimedLine("rev-5", 20600, [
      { text: "Counting", durMs: 520 },
      { text: "every", durMs: 440 },
      { text: "heartbeat", durMs: 640 },
      { text: "out", durMs: 340 },
      { text: "of", durMs: 240 },
      { text: "time", durMs: 860 },
    ]),
  ];

  const extended: LyricLine[] = [...baseLines];
  for (let repeat = 1; repeat <= 10; repeat++) {
    const shift = repeat * 26000;
    for (const line of baseLines) {
      if (line.startMs + shift >= 306000) break;
      extended.push({
        ...line,
        id: `${line.id}-r${repeat}`,
        startMs: line.startMs + shift,
        endMs: line.endMs + shift,
        words: line.words?.map((w) => ({
          ...w,
          startMs: w.startMs + shift,
          endMs: w.endMs + shift,
        })),
      });
    }
  }

  return {
    kind: "word",
    provider: "demo",
    lines: extended,
    trackKey,
  };
}

function buildNeonRequiemLineSynced(trackKey: string): LyricsDocument {
  // Deliberately line-synced (LRCLIB fallback format) to verify clean full-line highlight
  const phrases = [
    "Signals fading past the violet skyline",
    "Static humming on an open wire",
    "Ghost reflections on the glass horizon",
    "Holding rhythm while the circuits tire",
    "Midnight pulse across the empty highway",
    "Neon echoes in the falling rain",
    "Every frequency returns to zero",
    "Waiting softly for the next refrain",
  ];

  const lines: LyricLine[] = [];
  for (let i = 0; i < 42; i++) {
    const startMs = 500 + i * 4500;
    if (startMs >= 194000) break;
    lines.push({
      id: `nr-${i}`,
      startMs,
      endMs: startMs + 4500,
      text: phrases[i % phrases.length],
    });
  }

  return {
    kind: "line",
    provider: "lrclib",
    lines,
    trackKey,
  };
}

export function getDemoLyricsForTrack(
  track: string,
  artist: string,
  duration: number,
): LyricsDocument | null {
  const trackKey = buildTrackKey(track, artist, duration);
  const normTrack = track.trim().toLowerCase();
  const normArtist = artist.trim().toLowerCase();

  if (normTrack === "we on go" && normArtist === "bia") {
    return buildWeOnGoLyrics(trackKey);
  }
  if (normTrack === "the revenge" && normArtist === "shashwat sachdev") {
    return buildTheRevengeLyrics(trackKey);
  }
  if (normTrack === "neon requiem" && normArtist === "synth replicant") {
    return buildNeonRequiemLineSynced(trackKey);
  }
  if (normTrack === "warm static" && normArtist === "analog ritual") {
    return {
      kind: "instrumental",
      provider: "lrclib",
      lines: [],
      trackKey,
    };
  }
  return null;
}
