export const SITE = {
  name: "VinylDeck",
  version: "v2.3.2",
  repoUrl: "https://github.com/ItsRudraksh/vinyldeck",
  releasesUrl: "https://github.com/ItsRudraksh/vinyldeck/releases/tag/v2.3.2",
  downloadExeUrl:
    "https://github.com/ItsRudraksh/vinyldeck/releases/download/v2.3.2/VinylDeck_2.3.2_x64-setup.exe",
  downloadMsiUrl:
    "https://github.com/ItsRudraksh/vinyldeck/releases/download/v2.3.2/VinylDeck_2.3.2_x64_en-US.msi",
  platformNote: "Windows 10 & 11 (x64) · Native Tauri v2 + Rust",
} as const;

export interface HeroLyricLine {
  id: number;
  words: string[];
  bgVocal?: string;
}

export const HERO_LYRICS: HeroLyricLine[] = [
  { id: 0, words: ["I", "got", "a", "condo", "in", "Manhattan"] },
  {
    id: 1,
    words: ["Baby", "girl,", "what's", "happenin'?"],
    bgVocal: "(What's happenin'?)",
  },
  { id: 2, words: ["You", "and", "your", "crew", "invited"] },
  {
    id: 3,
    words: ["Turn", "around", "and", "drop", "it", "for", "a", "player"],
    bgVocal: "(Drop it)",
  },
  { id: 4, words: ["I'll", "rent", "a", "beach", "house", "in", "Miami"] },
];

export interface ScriptSample {
  id: string;
  label: string;
  langTag: string;
  track: string;
  artist: string;
  accent: string;
  lines: {
    native: string;
    romanized: string;
    translated: string;
  }[];
}

export const SCRIPT_SAMPLES: ScriptSample[] = [
  {
    id: "ja",
    label: "日本語",
    langTag: "Japanese · Auto-Romaji",
    track: "Shinunoga E-Wa",
    artist: "Fujii Kaze",
    accent: "#78A9FF",
    lines: [
      {
        native: "指切りげんまん ホラでも吹いたら",
        romanized: "Yubikiri genman hora demo fuitara",
        translated: "Pinky promise, if I ever tell a lie",
      },
      {
        native: "針でもなんでも 飲ませていただき Monday",
        romanized: "Hari demo nandemo nomasete itadaki Monday",
        translated: "Make me swallow a thousand needles on Monday",
      },
      {
        native: "私の最後はあなたがいい",
        romanized: "Watashi no saigo wa anata ga ii",
        translated: "I want my final moment to be with you",
      },
    ],
  },
  {
    id: "ru",
    label: "Русский",
    langTag: "Russian · Auto-Latin",
    track: "Sudno (Boris Ryzhy)",
    artist: "Molchat Doma",
    accent: "#94A3B8",
    lines: [
      {
        native: "Эмалированное судно",
        romanized: "Emalirovannoye sudno",
        translated: "An enameled vessel",
      },
      {
        native: "Окошко, тумбочка, кровать",
        romanized: "Okoshko, tumbochka, krovat'",
        translated: "A window, a nightstand, a bed",
      },
      {
        native: "Жить тяжело и неуютно",
        romanized: "Zhit' tyazhelo i neuyutno",
        translated: "Living is heavy and uncomfortable",
      },
    ],
  },
  {
    id: "pa",
    label: "ਪੰਜਾਬੀ",
    langTag: "Punjabi · Auto-Romanize",
    track: "Softly",
    artist: "Karan Aujla",
    accent: "#E5A96D",
    lines: [
      {
        native: "ਤੇਰੇ ਬਿਨਾਂ ਦਿਲ ਲੱਗਦਾ ਨੀ ਮੇਰਾ",
        romanized: "Tere bina dil lagda ni mera",
        translated: "Without you, my heart never settles",
      },
      {
        native: "ਰਾਤਾਂ ਨੂੰ ਨੀਂਦ ਆਉਂਦੀ ਨੀ ਸਵੇਰਾ",
        romanized: "Raatan nu neend aundi ni savera",
        translated: "Sleep escapes the night until morning",
      },
      {
        native: "ਹੌਲੀ ਹੌਲੀ ਗੱਲ ਦਿਲ ਵਾਲੀ ਕਹਿ ਦੇ",
        romanized: "Hauli hauli gall dil wali keh de",
        translated: "Softly tell me what is on your heart",
      },
    ],
  },
  {
    id: "hi",
    label: "हिन्दी",
    langTag: "Hindi · Auto-Romanize",
    track: "Dehshat Ho",
    artist: "Raftaar & Yashraj",
    accent: "#F48B6E",
    lines: [
      {
        native: "शहर में चर्चा है नाम का हमारे",
        romanized: "Shehar mein charcha hai naam ka humare",
        translated: "The whole city talks about our name",
      },
      {
        native: "जब भी उतरते हैं माइक के सहारे",
        romanized: "Jab bhi utarte hain mic ke sahaare",
        translated: "Whenever we step up behind the mic",
      },
      {
        native: "आवाज़ गूँजेगी रातों के पार",
        romanized: "Awaaz goonjegi raaton ke paar",
        translated: "The voice echoes straight through the night",
      },
    ],
  },
  {
    id: "es",
    label: "Español",
    langTag: "Spanish · Native Latin",
    track: "Despacito",
    artist: "Luis Fonsi",
    accent: "#E07A5F",
    lines: [
      {
        native: "Sí, sabes que ya llevo un rato mirándote",
        romanized: "Sí, sabes que ya llevo un rato mirándote",
        translated: "Yes, you know I've been watching you for a while",
      },
      {
        native: "Tengo que bailar contigo hoy",
        romanized: "Tengo que bailar contigo hoy",
        translated: "I have to dance with you today",
      },
      {
        native: "Vi que tu mirada ya estaba llamándome",
        romanized: "Vi que tu mirada ya estaba llamándome",
        translated: "I saw that your gaze was already calling me",
      },
    ],
  },
];

export interface ArchitectureMetric {
  id: string;
  metric: string;
  label: string;
  detail: string;
  span: "wide" | "tall" | "standard";
}

export const ARCHITECTURE_BENTO: ArchitectureMetric[] = [
  {
    id: "smtc",
    metric: "WinRT SMTC",
    label: "Zero-login system telemetry",
    detail:
      "Reads live track metadata, album art, timeline position, and transport state straight from Windows System Media Transport Controls—Spotify, YouTube, Apple Music, Tidal, or VLC.",
    span: "wide",
  },
  {
    id: "cache",
    metric: "0 ms",
    label: "On-disk Rust LRU lyrics cache",
    detail:
      "Persisted in your local Tauri app-data folder. Replayed tracks load word-synced karaoke and romanization instantaneously across restarts.",
    span: "standard",
  },
  {
    id: "engine",
    metric: "60 FPS",
    label: "Compositor-locked lyrics & tonearm",
    detail:
      "Depth-of-field blur, word-sweep masks, and vinyl angular velocity stay locked to GPU transform and opacity layers with zero cover-art flicker on pause or skip.",
    span: "standard",
  },
  {
    id: "tray",
    metric: "Rust + Tauri v2",
    label: "Unified system tray & lightweight footprint",
    detail:
      "Tray Play/Pause/Next/Prev controls route through the exact same SMTC command bus as the main stage, inside a ~12 MB native Windows binary.",
    span: "wide",
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Which music players work with VinylDeck?",
    a: "Anything that publishes to Windows System Media Transport Controls (SMTC)—including Spotify, Apple Music, YouTube Music, Chrome, Edge, Firefox, Tidal, foobar2000, and VLC. No accounts, plugins, or API tokens required.",
  },
  {
    q: "Why does Windows SmartScreen show a warning on first launch?",
    a: "VinylDeck is an independent open-source release without a paid EV code-signing certificate yet. Click 'More info' → 'Run anyway', or inspect and compile the source directly from the GitHub repository.",
  },
  {
    q: "How does Auto-Romanize work without auto-translating?",
    a: "When a song uses Japanese, Korean, Russian, Hindi, Punjabi, or Chinese script, VinylDeck automatically displays readable phonetic Latin lines so you can sing along. Meaning translations stay strictly manual via Shift+T or the Tr pill.",
  },
  {
    q: "What are the system requirements?",
    a: "Windows 10 (1903+) or Windows 11 (64-bit) with Microsoft Edge WebView2 Runtime (already pre-installed on Windows 11 and automatically bootstrapped by the setup.exe installer).",
  },
];
