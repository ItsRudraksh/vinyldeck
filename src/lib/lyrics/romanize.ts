// src/lib/lyrics/romanize.ts
// Zero-dependency, instant offline phonetic romanizers for:
//   - Korean Hangul (Revised Romanization)
//   - Japanese Hiragana & Katakana (Modified Hepburn)
//   - Punjabi Gurmukhi (phonetic Latin)
//   - Hindi Devanagari (phonetic Latin)
// Plus word-level alignment helpers so enabling Romanization replaces primary
// lyrics while preserving 60fps word-by-word karaoke sweep.

import type { LyricWord } from "./types";

// ── Script detection helpers ─────────────────────────────────

const OFFLINE_SUPPORTED_NON_LATIN =
  /[\u0900-\u097F\u0A00-\u0A7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7AF]/;

// Scripts that require backend/network romanization (Kanji/Hanzi, Arabic,
// Cyrillic, Thai, Greek, Hebrew, Bengali, Tamil, Telugu, etc.)
const REQUIRES_NETWORK_ROMANIZATION =
  /[\u0370-\u03FF\u0400-\u052F\u0590-\u06FF\u0750-\u077F\u0980-\u09FF\u0A80-\u0D7F\u0E00-\u0E7F\u3400-\u4DBF\u4E00-\u9FFF]/;

/**
 * Returns true if the text contains non-Latin characters that can be romanized
 * 100% offline with zero network calls (Korean Hangul, Kana-only Japanese,
 * Punjabi Gurmukhi, Hindi Devanagari).
 */
export function canRomanizeOffline(text: string): boolean {
  if (!text) return false;
  return (
    OFFLINE_SUPPORTED_NON_LATIN.test(text) &&
    !REQUIRES_NETWORK_ROMANIZATION.test(text)
  );
}

// ── 1. Korean Hangul (Revised Romanization) ──────────────────

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

const HANGUL_INITIALS = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp",
  "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
] as const;

const HANGUL_MEDIALS = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o",
  "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu",
  "eu", "ui", "i",
] as const;

const HANGUL_FINALS = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m",
  "l", "l", "l", "l", "l", "m", "p", "p", "t", "t",
  "ng", "t", "t", "k", "t", "p", "t",
] as const;

// Final consonant overrides when the following syllable starts with ㅇ (vowel)
const HANGUL_FINALS_BEFORE_VOWEL: Partial<Record<number, string>> = {
  1: "g",   // ㄱ
  4: "n",   // ㄴ
  7: "d",   // ㄷ
  8: "r",   // ㄹ
  16: "m",  // ㅁ
  17: "b",  // ㅂ
  19: "s",  // ㅅ
  20: "ss", // ㅆ
  22: "j",  // ㅈ
  23: "ch", // ㅊ
  24: "k",  // ㅋ
  25: "t",  // ㅌ
  26: "p",  // ㅍ
};

function romanizeHangulRun(run: string): string {
  let out = "";
  for (let i = 0; i < run.length; i++) {
    const code = run.charCodeAt(i);
    if (code < HANGUL_BASE || code > HANGUL_END) {
      out += run[i];
      continue;
    }
    const offset = code - HANGUL_BASE;
    const initial = Math.floor(offset / 588);
    const medial = Math.floor((offset % 588) / 28);
    const finalIdx = offset % 28;

    let initStr: string = HANGUL_INITIALS[initial];
    // ㄹ after a syllable ending in ㄹ is "l" (e.g., 빨래 -> ppallae)
    if (initial === 5 && out.endsWith("l")) {
      initStr = "l";
    }

    let finalStr: string = HANGUL_FINALS[finalIdx];
    if (finalIdx > 0 && i + 1 < run.length) {
      const nextCode = run.charCodeAt(i + 1);
      if (nextCode >= HANGUL_BASE && nextCode <= HANGUL_END) {
        const nextInitial = Math.floor((nextCode - HANGUL_BASE) / 588);
        if (nextInitial === 11 && HANGUL_FINALS_BEFORE_VOWEL[finalIdx]) {
          finalStr = HANGUL_FINALS_BEFORE_VOWEL[finalIdx]!;
        } else if (finalIdx === 8 && nextInitial === 5) {
          finalStr = "l";
        }
      }
    }

    out += initStr + HANGUL_MEDIALS[medial] + finalStr;
  }
  return out;
}

// ── 2. Japanese Hiragana & Katakana (Modified Hepburn) ───────

const KANA_DIGRAPHS: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  じゃ: "ja",  じゅ: "ju",  じょ: "jo",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ふぁ: "fa",  ふぃ: "fi",  ふぇ: "fe",  ふぉ: "fo",
  てぃ: "ti",  でぃ: "di",  ゔぁ: "va",  ゔぃ: "vi",  ゔぇ: "ve",  ゔぉ: "vo",
  うぃ: "wi",  うぇ: "we",  うぉ: "wo",  ちぇ: "che", しぇ: "she", じぇ: "je",
};

const KANA_SINGLE: Record<string, string> = {
  あ: "a",  い: "i",  う: "u",  え: "e",  お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i",  ゑ: "e",  を: "o",  ん: "n",
  ぁ: "a",  ぃ: "i",  ぅ: "u",  ぇ: "e",  ぉ: "o",
  ゃ: "ya", ゅ: "yu", ょ: "yo", ゔ: "vu",
};

function toHiragana(ch: string): string {
  const code = ch.charCodeAt(0);
  // Katakana ァ (0x30A1) .. ヶ (0x30F6) -> Hiragana
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCharCode(code - 0x60);
  }
  return ch;
}

function romanizeKanaRun(run: string): string {
  const hira = Array.from(run, toHiragana);
  let out = "";
  let i = 0;

  while (i < hira.length) {
    const ch = hira[i];

    // Chōonpu (ー): lengthen previous vowel
    if (ch === "ー") {
      const last = out[out.length - 1];
      if (last && "aeiou".includes(last)) {
        out += last;
      }
      i += 1;
      continue;
    }

    // Sokuon (っ): double next consonant
    if (ch === "っ") {
      const nextPair = i + 2 < hira.length ? hira[i + 1] + hira[i + 2] : "";
      const nextRom =
        KANA_DIGRAPHS[nextPair] ?? (i + 1 < hira.length ? KANA_SINGLE[hira[i + 1]] : "");
      if (nextRom && /^[bcdfghjklmnpqrstvwxyz]/.test(nextRom)) {
        out += nextRom.startsWith("ch") ? "t" : nextRom[0];
      }
      i += 1;
      continue;
    }

    // Digraph check
    if (i + 1 < hira.length) {
      const pair = ch + hira[i + 1];
      if (KANA_DIGRAPHS[pair]) {
        out += KANA_DIGRAPHS[pair];
        i += 2;
        continue;
      }
    }

    // Single kana
    if (KANA_SINGLE[ch] !== undefined) {
      out += KANA_SINGLE[ch];
      i += 1;
      continue;
    }

    out += run[i];
    i += 1;
  }

  return out;
}

// ── 3. Punjabi Gurmukhi (Phonetic Latin) ─────────────────────

const GURMUKHI_VOWELS: Record<string, string> = {
  ਅ: "a", ਆ: "aa", ਇ: "i", ਈ: "ee", ਉ: "u", ਊ: "oo",
  ਏ: "e", ਐ: "ai", ਓ: "o", ਔ: "au", ੲ: "i", ੳ: "u",
};

const GURMUKHI_CONSONANTS: Record<string, string> = {
  ਸ: "s", ਹ: "h",
  ਕ: "k", ਖ: "kh", ਗ: "g", ਘ: "gh", ਙ: "ng",
  ਚ: "ch", ਛ: "chh", ਜ: "j", ਝ: "jh", ਞ: "ny",
  ਟ: "t", ਠ: "th", ਡ: "d", ਢ: "dh", ਣ: "n",
  ਤ: "t", ਥ: "th", ਦ: "d", ਧ: "dh", ਨ: "n",
  ਪ: "p", ਫ: "ph", ਬ: "b", ਭ: "bh", ਮ: "m",
  ਯ: "y", ਰ: "r", ਲ: "l", ਵ: "v", ੜ: "r",
  ਸ਼: "sh", ਖ਼: "kh", ਗ਼: "gh", ਜ਼: "z", ਫ਼: "f", ਲ਼: "l",
};

const GURMUKHI_MATRAS: Record<string, string> = {
  "ਾ": "aa", "ਿ": "i", "ੀ": "ee", "ੁ": "u", "ੂ": "oo",
  "ੇ": "e", "ੈ": "ai", "ੋ": "o", "ੌ": "au",
};

const GURMUKHI_NUKTA_BASE: Record<string, string> = {
  ਸ: "sh", ਖ: "kh", ਗ: "gh", ਜ: "z", ਫ: "f", ਲ: "l",
};

function romanizeGurmukhiWord(word: string): string {
  const chars = Array.from(word);
  let out = "";
  let geminateNext = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    // Addak (ੱ): doubles following consonant
    if (ch === "\u0A71") {
      geminateNext = true;
      continue;
    }

    // Bindi (ਂ) / Tippi (ੰ): nasalization
    if (ch === "\u0A02" || ch === "\u0A70") {
      out += "n";
      continue;
    }

    if (GURMUKHI_VOWELS[ch]) {
      out += GURMUKHI_VOWELS[ch];
      geminateNext = false;
      continue;
    }

    if (GURMUKHI_CONSONANTS[ch]) {
      let cons = GURMUKHI_CONSONANTS[ch];
      // Check combining nukta (਼)
      if (chars[i + 1] === "\u0A3C" && GURMUKHI_NUKTA_BASE[ch]) {
        cons = GURMUKHI_NUKTA_BASE[ch];
        i += 1;
      }

      if (geminateNext) {
        out += cons[0];
        geminateNext = false;
      }

      const next = chars[i + 1];
      if (next && GURMUKHI_MATRAS[next]) {
        out += cons + GURMUKHI_MATRAS[next];
        i += 1;
      } else if (next === "\u0A4D") {
        // Virama / halant suppresses inherent 'a'
        out += cons;
        i += 1;
      } else {
        // Inherent 'a' except at word-final position (schwa deletion)
        const isLastPhonetic =
          i === chars.length - 1 ||
          (i === chars.length - 2 &&
            (chars[i + 1] === "\u0A02" || chars[i + 1] === "\u0A70"));
        out += isLastPhonetic ? cons : `${cons}a`;
      }
      continue;
    }

    if (GURMUKHI_MATRAS[ch]) {
      out += GURMUKHI_MATRAS[ch];
      continue;
    }

    out += ch;
  }

  return out;
}

// ── 4. Hindi Devanagari (Phonetic Latin) ─────────────────────

const DEVA_VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo",
  ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o",
};

const DEVA_CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h", ळ: "l",
  क़: "q", ख़: "kh", ग़: "gh", ज़: "z", ड़: "r", ढ़: "rh", फ़: "f",
};

const DEVA_NUKTA_BASE: Record<string, string> = {
  क: "q", ख: "kh", ग: "gh", ज: "z", ड: "r", ढ: "rh", फ: "f",
};

const DEVA_MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o",
};

function romanizeDevanagariWord(word: string): string {
  const chars = Array.from(word);
  let out = "";

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (ch === "\u0902" || ch === "\u0901") {
      // Anusvara / Chandrabindu
      out += "n";
      continue;
    }
    if (ch === "\u0903") {
      out += "h";
      continue;
    }
    if (ch === "।") {
      out += ".";
      continue;
    }

    if (DEVA_VOWELS[ch]) {
      out += DEVA_VOWELS[ch];
      continue;
    }

    if (DEVA_CONSONANTS[ch]) {
      let cons = DEVA_CONSONANTS[ch];
      if (chars[i + 1] === "\u093C" && DEVA_NUKTA_BASE[ch]) {
        cons = DEVA_NUKTA_BASE[ch];
        i += 1;
      }

      const next = chars[i + 1];
      if (next && DEVA_MATRAS[next]) {
        out += cons + DEVA_MATRAS[next];
        i += 1;
      } else if (next === "\u094D") {
        // Halant / virama
        out += cons;
        i += 1;
      } else {
        const isLastPhonetic =
          i === chars.length - 1 ||
          (i === chars.length - 2 &&
            (chars[i + 1] === "\u0902" || chars[i + 1] === "\u0901"));
        out += isLastPhonetic ? cons : `${cons}a`;
      }
      continue;
    }

    if (DEVA_MATRAS[ch]) {
      out += DEVA_MATRAS[ch];
      continue;
    }

    out += ch;
  }

  return out;
}

// ── Unified Offline Romanizer Entry Point ────────────────────

const SCRIPT_TOKEN_REGEX =
  /([\uAC00-\uD7AF]+)|([\u3040-\u30FFー]+)|([\u0A00-\u0A7F]+)|([\u0900-\u097F]+)/g;

/**
 * Deterministically romanizes Korean Hangul, Japanese Kana, Punjabi Gurmukhi,
 * and Hindi Devanagari runs inside `text` while leaving Latin text, spaces,
 * and punctuation intact.
 */
export function romanizeOffline(text: string): string {
  if (!text || !OFFLINE_SUPPORTED_NON_LATIN.test(text)) return text;

  return text.replace(
    SCRIPT_TOKEN_REGEX,
    (match, hangul?: string, kana?: string, gurmukhi?: string, deva?: string) => {
      if (hangul) return romanizeHangulRun(hangul);
      if (kana) return romanizeKanaRun(kana);
      if (gurmukhi) return romanizeGurmukhiWord(gurmukhi);
      if (deva) return romanizeDevanagariWord(deva);
      return match;
    },
  );
}

/**
 * Romanizes each timed word token offline when the entire line uses offline-supported
 * scripts (Hangul, Kana, Gurmukhi, Devanagari), preserving exact word timing & spacing.
 */
export function romanizeWordTokensOffline(words: LyricWord[]): string[] | null {
  if (!words || words.length === 0) return null;
  const full = words.map((w) => w.text).join("");
  if (!canRomanizeOffline(full)) return null;

  return words.map((w, idx) => {
    const rom = romanizeOffline(w.text);
    // Ensure CJK/Kana syllable tokens that had no spaces between them don't mash into
    // unreadable walls when converted to Latin unless original had trailing space
    if (
      idx < words.length - 1 &&
      !/\s$/.test(rom) &&
      !/^[\s.,!?;:)'"”’]/.test(words[idx + 1].text) &&
      /[\u3040-\u30FF]/.test(w.text)
    ) {
      return `${rom} `;
    }
    return rom;
  });
}

/**
 * Aligns a line-level romanized string (from LyricsPlus, TTML x-roman, or
 * per-line GTX enrichment for Kanji/Chinese/Arabic/etc.) onto existing timed
 * `LyricWord` entries so karaoke word-by-word sweep stays smooth when
 * Romanization replaces the primary line.
 */
export function alignRomanizedWords(
  words: LyricWord[],
  romanizedLine: string,
): string[] | null {
  const trimmed = romanizedLine.trim();
  if (!trimmed || words.length === 0) return null;

  if (words.length === 1) {
    return [trimmed];
  }

  // Split into whitespace-delimited words
  const romTokens = trimmed.split(/\s+/).filter(Boolean);
  if (romTokens.length === 0) return null;

  // Exact 1:1 token match (very common for Korean, Punjabi, Hindi, Russian, Arabic)
  if (romTokens.length === words.length) {
    return romTokens.map((tok, i) => (i < romTokens.length - 1 ? `${tok} ` : tok));
  }

  // Proportional distribution by word duration (with character-length fallback)
  const weights = words.map((w) => {
    const dur = Math.max(80, w.endMs - w.startMs);
    const len = Math.max(1, w.text.trim().length);
    return dur * 0.6 + len * 60 * 0.4;
  });
  const totalWeight = weights.reduce((acc, v) => acc + v, 0) || 1;

  const assigned: string[][] = words.map(() => []);
  let cumulative = 0;
  let nextWordIdx = 0;

  for (let t = 0; t < romTokens.length; t++) {
    const tokenPos = (t + 0.5) / romTokens.length;
    while (
      nextWordIdx < words.length - 1 &&
      (cumulative + weights[nextWordIdx]) / totalWeight < tokenPos
    ) {
      cumulative += weights[nextWordIdx];
      nextWordIdx += 1;
    }
    assigned[nextWordIdx].push(romTokens[t]);
  }

  // Build final strings with clean spacing between non-empty buckets
  const result = assigned.map((bucket) => bucket.join(" "));
  let lastNonEmpty = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].length > 0) {
      lastNonEmpty = i;
      break;
    }
  }

  return result.map((chunk, i) =>
    chunk.length > 0 && i < lastNonEmpty ? `${chunk} ` : chunk,
  );
}
