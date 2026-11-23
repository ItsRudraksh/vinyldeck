import { describe, expect, it } from "vitest";
import {
  buildDisplayLinesWithInterludes,
  cleanArtistName,
  cleanTrackTitle,
  findActiveLyricPosition,
  formatTimestampMs,
  hasNonLatinScript,
  isSaneRomanization,
  normalizeLangCode,
  normalizeTrackQuery,
  parseGtxEnrichmentResponse,
  parseGtxSingleLineResponse,
  parseLrcLyrics,
  parseLyricsPlusResponse,
  parseTtmlLyrics,
  parseTtmlTimestampToMs,
  shouldDisplayLyricsStage,
  stripFeaturing,
} from "./parsers";
import {
  alignRomanizedWords,
  canRomanizeOffline,
  romanizeOffline,
  romanizeWordTokensOffline,
} from "./romanize";

describe("lyrics query normalization", () => {
  it("strips official video, remaster, and lyric suffixes from track titles", () => {
    expect(cleanTrackTitle("Blinding Lights (Official Music Video)")).toBe(
      "Blinding Lights",
    );
    expect(cleanTrackTitle("Dreams [2004 Remastered]")).toBe("Dreams");
    expect(cleanTrackTitle("Midnight City - Single Version")).toBe(
      "Midnight City",
    );
  });

  it("cleans YouTube Topic artist suffix and featuring tags", () => {
    expect(cleanArtistName("Daft Punk - Topic")).toBe("Daft Punk");
    expect(stripFeaturing("Starboy (feat. Daft Punk)")).toBe("Starboy");
  });

  it("buckets durations to 2s intervals for stable cache keys", () => {
    const a = normalizeTrackQuery({
      track: "We On Go (Official Audio)",
      artist: "BIA",
      album: "We On Go",
      duration: 247,
    });
    const b = normalizeTrackQuery({
      track: "We On Go",
      artist: "BIA - Topic",
      album: "",
      duration: 248,
    });
    expect(a.trackKey).toBe(b.trackKey);
  });
});

describe("LyricsPlus JSON parser", () => {
  it("parses word-by-word syllabus timings, duet singers, background vocals, and native transliteration", () => {
    const payload = {
      type: "Word",
      lyrics: [
        {
          time: 1000,
          duration: 2000,
          text: "死ぬのがいいわ",
          transliteration: { text: "Shinu no ga ii wa" },
          translation: { text: "I'd rather die", lang: "en" },
          syllabus: [
            { time: 1000, duration: 900, text: "死ぬのが" },
            { time: 1900, duration: 1100, text: "いいわ" },
          ],
          element: { singer: "v1" },
        },
        {
          time: 3200,
          duration: 1500,
          text: "(echo)",
          syllabus: [{ time: 3200, duration: 1500, text: "(echo)", isBackground: true }],
          element: { singer: "v2" },
        },
      ],
    };

    const doc = parseLyricsPlusResponse(payload, "artist::track::180");
    expect(doc).not.toBeNull();
    expect(doc?.kind).toBe("word");
    expect(doc?.hasNonLatinScript).toBe(true);
    expect(doc?.lines).toHaveLength(2);
    expect(doc?.lines[0].romanized).toBe("Shinu no ga ii wa");
    expect(doc?.lines[0].translations?.en).toBe("I'd rather die");
    expect(doc?.lines[0].words).toHaveLength(2);
    expect(doc?.lines[1].singer).toBe("secondary");
    expect(doc?.lines[1].isBackground).toBe(true);
  });
});

describe("TTML parser", () => {
  it("parses timestamps across HH:MM:SS, MM:SS, and seconds formats", () => {
    expect(parseTtmlTimestampToMs("01:02:03.450")).toBe(3723450);
    expect(parseTtmlTimestampToMs("02:15.5")).toBe(135500);
    expect(parseTtmlTimestampToMs("14.25s")).toBe(14250);
    expect(parseTtmlTimestampToMs("850ms")).toBe(850);
  });

  it("extracts timed spans, nested x-bg background vocals, and isolates x-roman/x-translation", () => {
    const xml = `
      <tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
        <body><div>
          <p begin="00:10.000" end="00:12.500" ttm:agent="v1">
            <span begin="00:10.000" end="00:11.000">死ぬのが</span>
            <span begin="00:11.000" end="00:12.500">いいわ</span>
            <span ttm:role="x-roman">Shinu no ga ii wa</span>
            <span ttm:role="x-translation" xml:lang="en-US">I'd rather die</span>
          </p>
          <p begin="00:13.000" end="00:14.200">
            <span ttm:role="x-bg"><span begin="00:13.000" end="00:14.200">Honorable</span></span>
          </p>
        </div></body>
      </tt>
    `;

    const doc = parseTtmlLyrics(xml, "a::b::120");
    expect(doc?.kind).toBe("word");
    expect(doc?.lines).toHaveLength(2);
    expect(doc?.lines[0].text).toBe("死ぬのが いいわ");
    expect(doc?.lines[0].romanized).toBe("Shinu no ga ii wa");
    expect(doc?.lines[0].translations?.en).toBe("I'd rather die");
    expect(doc?.lines[0].words).toHaveLength(2);
    expect(doc?.lines[1].text).toBe("Honorable");
    expect(doc?.lines[1].isBackground).toBe(true);
    expect(doc?.lines[1].words?.[0].isBackground).toBe(true);
  });

  it("extracts Apple Music iTunesMetadata head transliterations and guards against merged dumps", () => {
    const xml = `
      <tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
        <head><metadata><iTunesMetadata>
          <transliterations><transliteration xml:lang="ja-Latn">
            <text for="L4"><span begin="18.212" end="19.020">i</span><span begin="19.020" end="19.422">mawa</span> <span begin="19.422" end="19.972">no</span></text>
          </transliteration></transliterations>
          <translations><translation xml:lang="en">
            <text for="L4">At the very brink</text>
          </translation></translations>
        </iTunesMetadata></metadata></head>
        <body><div>
          <p begin="18.212" end="19.972" itunes:key="L4" ttm:agent="v1">
            <span begin="18.212" end="19.020">今</span><span begin="19.020" end="19.422">際</span><span begin="19.422" end="19.972">の</span>
          </p>
        </div></body>
      </tt>
    `;
    const doc = parseTtmlLyrics(xml, "king gnu::specialz::238");
    expect(doc?.lines).toHaveLength(1);
    expect(doc?.lines[0].romanized).toBe("imawa no");
    expect(doc?.lines[0].romanizedTimedWords).toHaveLength(3);
    expect(doc?.lines[0].translations?.en).toBe("At the very brink");
    expect(isSaneRomanization("今際の", "imawa no")).toBe(true);
    expect(isSaneRomanization("今際の", "A".repeat(400))).toBe(false);
  });
});

describe("LRCLIB LRC and Enhanced LRC parser", () => {
  it("parses standard line-synced LRC including multi-timestamp lines", () => {
    const lrc = [
      "[00:05.00]First line",
      "[00:10.50][00:25.00]Chorus line",
      "[00:15.25]Second verse",
    ].join("\n");

    const doc = parseLrcLyrics(lrc, 60, "a::b::60");
    expect(doc?.kind).toBe("line");
    expect(doc?.lines.map((l) => l.startMs)).toEqual([5000, 10500, 15250, 25000]);
    expect(doc?.lines[1].text).toBe("Chorus line");
    expect(doc?.lines[3].text).toBe("Chorus line");
  });

  it("upgrades to word-level lyrics when enhanced LRC word tags are present", () => {
    const elrc = "[00:02.00]<00:02.00>Night <00:02.60>turns <00:03.20>gold";
    const doc = parseLrcLyrics(elrc, 30, "a::b::30");
    expect(doc?.kind).toBe("word");
    expect(doc?.lines[0].words).toHaveLength(3);
    expect(doc?.lines[0].words?.[1].startMs).toBe(2600);
  });
});

describe("offline multi-script romanizer and karaoke word alignment", () => {
  it("romanizes Korean Hangul, Japanese Kana, Punjabi Gurmukhi, and Hindi Devanagari offline", () => {
    expect(canRomanizeOffline("사랑해")).toBe(true);
    expect(romanizeOffline("사랑해")).toBe("saranghae");

    expect(canRomanizeOffline("さよなら")).toBe(true);
    expect(romanizeOffline("さよなら")).toBe("sayonara");
    expect(romanizeOffline("コーヒー")).toBe("koohii");

    expect(canRomanizeOffline("ਸਤ ਸ੍ਰੀ ਅਕਾਲ")).toBe(true);
    expect(romanizeOffline("ਪੰਜਾਬੀ")).toBe("panjaabee");

    expect(canRomanizeOffline("तुम ही हो")).toBe(true);
    expect(romanizeOffline("तुम ही हो")).toBe("tum hee ho");

    // Kanji requires network enrichment so canRomanizeOffline must return false
    expect(canRomanizeOffline("死ぬのがいいわ")).toBe(false);
  });

  it("aligns romanized words onto timed word arrays for karaoke sweep replacement", () => {
    const words = [
      { text: "사랑 ", startMs: 1000, endMs: 1500 },
      { text: "해", startMs: 1500, endMs: 2200 },
    ];
    expect(romanizeWordTokensOffline(words)).toEqual(["sarang ", "hae"]);

    const kanjiWords = [
      { text: "死ぬのが", startMs: 1000, endMs: 1900 },
      { text: "いいわ", startMs: 1900, endMs: 3000 },
    ];
    const aligned = alignRomanizedWords(kanjiWords, "Shinu no ga ii wa");
    expect(aligned).toHaveLength(2);
    expect(aligned!.join("").trim()).toBe("Shinu no ga ii wa");
  });
});

describe("interlude gap insertion, script guards, GTX parsing, and auto-hide", () => {
  it("inserts intro (>=1.2s) and inter-line (>=3.0s) 3-dot interlude rows without mutating source lines", () => {
    const source = [
      { id: "l0", startMs: 2500, endMs: 5000, text: "Opening line" },
      { id: "l1", startMs: 6000, endMs: 8000, text: "Close next line" },
      { id: "l2", startMs: 14000, endMs: 16500, text: "After instrumental break" },
    ];
    const display = buildDisplayLinesWithInterludes(source);
    expect(display).toHaveLength(5);
    expect(display[0].isInterlude).toBe(true);
    expect(display[0].startMs).toBe(0);
    expect(display[0].endMs).toBe(2500);
    expect(display[3].isInterlude).toBe(true);
    expect(display[3].startMs).toBe(8000);
    expect(display[3].endMs).toBe(14000);

    // Sync solver reports 0..1 interlude progress
    const midInterlude = findActiveLyricPosition(display, 11000);
    expect(midInterlude.lineIndex).toBe(3);
    expect(midInterlude.wordProgress).toBeCloseTo(0.5, 2);
  });

  it("detects non-Latin scripts accurately while treating Latin & romanized Punjabi as Latin", () => {
    expect(hasNonLatinScript("Oh veri nu jo maut diyan callan ghaldi")).toBe(false);
    expect(hasNonLatinScript("Midnight needle drops into the velvet groove")).toBe(false);
    expect(hasNonLatinScript("ਰੱਖੇ ਭੰਗ ਕੇ ਬੈਠੇ ਨਾ 6 ਜੰਨਾ")).toBe(true);
    expect(hasNonLatinScript("तुम ही हो")).toBe(true);
    expect(hasNonLatinScript("死ぬのがいいわ")).toBe(true);
    expect(hasNonLatinScript("사랑해")).toBe(true);
    expect(hasNonLatinScript("你好世界")).toBe(true);
    expect(hasNonLatinScript("مرحبا بالعالم")).toBe(true);
    expect(hasNonLatinScript("Привет мир")).toBe(true);
    expect(normalizeLangCode("zh-CN")).toBe("zh");
    expect(normalizeLangCode("en_US")).toBe("en");
  });

  it("parses single-line and batched GTX enrichment responses cleanly", () => {
    const single = [
      [
        ["I'd rather die", "死ぬのがいいわ", null, null, 10],
        [null, null, null, "Shinu no ga ii wa"],
      ],
      null,
      "ja",
    ];
    expect(parseGtxSingleLineResponse(single)).toEqual({
      sourceLang: "ja",
      translated: "I'd rather die",
      romanized: "Shinu no ga ii wa",
    });

    const multi = [
      [
        ["Line one\n", "一行目\n", null, null, 10],
        ["Line two", "二行目", null, null, 10],
        [null, null, null, "Ichigyoume\nNigyoume"],
      ],
      null,
      "ja",
    ];
    expect(parseGtxEnrichmentResponse(multi, 2)).toEqual({
      sourceLang: "ja",
      translatedLines: ["Line one", "Line two"],
      romanizedLines: ["Ichigyoume", "Nigyoume"],
    });
  });

  it("auto-hides lyrics stage for instrumental and not_found tracks while preserving lyricsEnabled", () => {
    const instrumentalDoc = {
      kind: "instrumental" as const,
      provider: "lrclib" as const,
      lines: [],
      trackKey: "k",
    };
    const notFoundDoc = {
      kind: "not_found" as const,
      provider: "lrclib" as const,
      lines: [],
      trackKey: "k",
    };
    const wordDoc = {
      kind: "word" as const,
      provider: "lyricsplus" as const,
      lines: [{ id: "1", startMs: 0, endMs: 1000, text: "Hi" }],
      trackKey: "k",
    };

    expect(shouldDisplayLyricsStage(true, true, "ready", instrumentalDoc)).toBe(false);
    expect(shouldDisplayLyricsStage(true, true, "ready", notFoundDoc)).toBe(false);
    expect(shouldDisplayLyricsStage(true, true, "ready", wordDoc)).toBe(true);
    expect(shouldDisplayLyricsStage(false, true, "ready", wordDoc)).toBe(false);
    expect(shouldDisplayLyricsStage(true, true, "loading", null)).toBe(true);
  });
});

describe("binary-search active lyric solver and timestamp formatter", () => {
  it("resolves active line, active word, and clamped 0..1 sweep progress", () => {
    const doc = parseLyricsPlusResponse(
      {
        type: "Word",
        lyrics: [
          {
            time: 1000,
            duration: 2000,
            text: "One two",
            syllabus: [
              { time: 1000, duration: 1000, text: "One " },
              { time: 2000, duration: 1000, text: "two" },
            ],
          },
          {
            time: 4000,
            duration: 1500,
            text: "Three",
            syllabus: [{ time: 4000, duration: 1500, text: "Three" }],
          },
        ],
      },
      "k",
    );

    const lines = doc!.lines;
    expect(findActiveLyricPosition(lines, 500)).toEqual({
      lineIndex: -1,
      wordIndex: -1,
      wordProgress: 0,
    });
    expect(findActiveLyricPosition(lines, 1500)).toEqual({
      lineIndex: 0,
      wordIndex: 0,
      wordProgress: 0.5,
    });
    expect(findActiveLyricPosition(lines, 2750)).toEqual({
      lineIndex: 0,
      wordIndex: 1,
      wordProgress: 0.75,
    });
    expect(findActiveLyricPosition(lines, 6500)).toEqual({
      lineIndex: 1,
      wordIndex: 0,
      wordProgress: 1,
    });
  });

  it("formats seek timestamps cleanly", () => {
    expect(formatTimestampMs(125000)).toBe("2:05");
    expect(formatTimestampMs(0)).toBe("0:00");
  });

  it("preserves exact reading order when overlapping background vocals start before lead word ends", () => {
    const payload = {
      type: "Word",
      lyrics: [
        {
          time: 10000,
          duration: 3000,
          text: "Turn around and drop it for a player (Drop it)",
          syllabus: [
            { time: 10000, duration: 400, text: "Turn " },
            { time: 10400, duration: 400, text: "around " },
            { time: 10800, duration: 300, text: "and " },
            { time: 11100, duration: 300, text: "drop " },
            { time: 11400, duration: 200, text: "it " },
            { time: 11600, duration: 200, text: "for " },
            { time: 11800, duration: 200, text: "a " },
            { time: 12000, duration: 900, text: "player " },
            { time: 11900, duration: 350, text: "(Drop ", isBackground: true },
            { time: 12250, duration: 350, text: "it)", isBackground: true },
          ],
        },
      ],
    };

    const doc = parseLyricsPlusResponse(payload, "bruno::thats-what-i-like::206");
    expect(doc).not.toBeNull();
    const words = doc!.lines[0].words!.map((w) => w.text);
    expect(words.join("")).toBe("Turn around and drop it for a player (Drop it)");
  });

  it("parses nested Apple Music TTML x-bg background vocals without dropping first word and strips outer parens", () => {
    const ttml = `<tt><body><div>
      <p begin="0:12.000" end="0:15.000">
        <span begin="0:12.000" end="0:12.400">Turn</span>
        <span begin="0:12.400" end="0:12.800">around</span>
        <span begin="0:12.800" end="0:13.400">player</span>
        <span ttm:role="x-bg"><span begin="0:13.100" end="0:13.500">(Drop</span> <span begin="0:13.500" end="0:13.900">it)</span></span>
      </p>
      <p begin="0:16.000" end="0:18.000">
        <span begin="0:16.000" end="0:16.800">Wake</span>
        <span begin="0:16.800" end="0:17.200">up</span>
        <span ttm:role="x-bg"><span begin="0:17.100" end="0:17.600">(Nope)</span></span>
      </p>
    </div></body></tt>`;

    const doc = parseTtmlLyrics(ttml, "bruno::thats-what-i-like::206");
    expect(doc).not.toBeNull();
    expect(doc!.lines).toHaveLength(2);

    const line0Lead = doc!.lines[0].words!.filter((w) => !w.isBackground).map((w) => w.text.trim());
    const line0Bg = doc!.lines[0].words!.filter((w) => w.isBackground).map((w) => w.text.trim());
    expect(line0Lead).toEqual(["Turn", "around", "player"]);
    expect(line0Bg).toEqual(["Drop", "it"]);

    const line1Bg = doc!.lines[1].words!.filter((w) => w.isBackground).map((w) => w.text.trim());
    expect(line1Bg).toEqual(["Nope"]);
  });
});
