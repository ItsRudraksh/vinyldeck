export const features = [
  {
    eyebrow: 'System Media',
    title: 'Works with what already plays.',
    text: 'Start music in Spotify, a browser, VLC, or another compatible player. VinylDeck listens to Windows media sessions and turns the active track into a visual deck.'
  },
  {
    eyebrow: 'Physical Vinyl',
    title: 'Not a flat album-art card.',
    text: 'The record has grooves, sheen, wobble, album-art label treatment, and a physical tonearm that makes the player feel like an object.'
  },
  {
    eyebrow: 'Realtime Lyrics',
    title: 'Word-by-word, with romanization and translations.',
    text: 'Follow zero-flicker karaoke lyrics in Split View or Compact Strip with damped-spring scrolling, 3-dot instrumental gap indicators, tucked background vocals, customizable font styles and sizes, left or right Split View placement, Auto-Romanize for foreign scripts, and manual Translations in 12 languages.'
  },
  {
    eyebrow: 'Window Modes',
    title: 'Main, fullscreen, or mini.',
    text: 'Use it as a focused desktop window, a lean-back fullscreen visual with lyrics, or a compact always-on-top Acrylic mini companion.'
  },
  {
    eyebrow: 'Native Feel',
    title: 'Built as a desktop app.',
    text: 'Tauri, Rust, React, tray lifecycle, persistent settings, shortcuts, and media commands keep the experience light and Windows-native.'
  }
];

export const faqs = [
  {
    q: 'Does VinylDeck play or stream music?',
    a: 'No. VinylDeck is a visual companion. It reads the active Windows media session and visualizes the track already playing in your usual app.'
  },
  {
    q: 'How do realtime lyrics, romanization, and translation work?',
    a: 'VinylDeck resolves word-synced and line-synced lyrics automatically through its Rust backend with no API keys required. Toggle Romanized (R) to replace non-Latin lyrics in-place while keeping karaoke sweep (instant offline for Korean, Japanese Kana, Punjabi, and Hindi; per-line for Kanji and other scripts), or Translated (Shift+T) in 12 languages stacked below.'
  },
  {
    q: 'Which players work best?',
    a: 'Spotify is the best first test source. Browsers, VLC, and other apps can work when they expose playback through compatible Windows media sessions.'
  },
  {
    q: 'What is Mini mode?',
    a: 'Mini mode is a compact, shrink-resizable always-on-top VinylDeck window with optional Windows Acrylic transparency designed to stay nearby without taking over the desktop.'
  },
  {
    q: 'Why might Windows show Publisher Unknown?',
    a: 'Unsigned local builds can show Publisher Unknown until code signing is added. That is a release-distribution step, not a design or feature limitation.'
  }
];
