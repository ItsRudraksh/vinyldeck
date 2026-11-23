## [2.3.2] - 2026-11-24

### Fixed
- **Zero Cover Art Flicker on Playback Controls**: `src-tauri/src/media/commands.rs` now preserves cached `artwork_data_url` from `MediaState` on same-track Play/Pause/Seek actions and fetches fresh artwork immediately on Next/Previous skips; `src/lib/playback/store.ts` adds a matching frontend guard so the vinyl label never flashes blank.
- **Translation Language Dropdown Alignment**: Added `box-sizing: border-box` to base `button` and `.settings-custom-select__trigger` (fixing `all: unset` reverting to `content-box` and poking past the card border).
- **Nested TTML Background Vocals (v2.3.1)**: Replaced regex span matching with a depth-aware stack parser and stacked tucked background vocals cleanly underneath lead lines.

### Performance & Release Polish
- **65% Smaller Startup Font Payload**: Pruned 7 unused Google Font families from `src/styles/global.css`.
- **Zero Background GPU/CPU Rotation**: Cached `#vinyl-disc` DOM ref, switched to GPU `rotate3d`, and automatically paused the 60fps rotation RAF loop whenever the window is hidden or minimized to tray.
- **Version Sync**: Bumped `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and Settings About panel to `2.3.2`.

## [2.3.0] - 2026-11-24

### Added
- **On-Disk Rust LRU Lyrics Cache (`lyrics_cache_v1.json`)**: `src-tauri/src/lyrics/mod.rs` now persists up to 250 fetched tracks and 250 enrichment records atomically inside Tauri's `app_data_dir()` so previously played songs load lyrics in 0ms across app restarts. Includes a new `cmd_lyrics_clear_cache` Tauri command.
- **Subtle Depth-of-Field Blur on Distant Split-View Lyrics**: Lines at `data-distance="2..4"` soften gently (`0.8px`–`1.8px`) so the active line pops cleanly, clearing immediately on hover, manual scroll, or `prefers-reduced-motion`.

### Fixed
- **Active-Line Karaoke Wrapping & Word Overlap**: Removed timestamp-reordering in `finalizeWords()` so overlapping background vocals (e.g., `(Drop it)`, `(What's happenin'?)`) always stay in exact reading order, and unified inactive/active word-span rendering in `LyricsStage` so line wrapping, spacing, and background-vocal sizing never shift on activation.
- **Settings Modal Readability & Contrast (Glass & Noir)**: Upgraded `.settings-overlay__scrim`, frosted Glass panel opacity, card fill, and dark-ink contrast so background lyrics never bleed through settings controls, and unwrapped card notes (`LIQUID DISPLAY CASE`) to prevent ellipsis truncation.
- **Translation Language Dropdown Overflow**: Fixed flex sizing (`flex: 1 1 0%` on label copy, fixed `156px` trigger width) so `<SettingsSelect>` sits cleanly inside its card border.

### Changed & Cleaned Up
- **Unified System Tray with Live SMTC**: System Tray Play/Pause/Next/Previous actions and tooltip now route directly through live Windows SMTC (`smtc_toggle_play_pause`, `smtc_next`, `smtc_previous`) and shared `MediaState` snapshots.
- **Dead-Code Removal**: Removed legacy `cmd_media_*` mock IPC commands, `MockMediaAuthority` (`src-tauri/src/media/mock.rs`), unused `VaporGrid` mounts in `MainView.tsx` / `MiniView.tsx`, and obsolete `src/lib/lyrics/offsets.ts`.

# Changelog

## Unreleased (v2.2)

### Added

- **Native Apple Music TTML `<iTunesMetadata>` Transliteration & Translation Parsing**: `parseTtmlLyrics` now extracts official syllable-timed `<transliterations>` (`romanizedTimedWords`) and `<translations>` from TTML `<head>` matched by `itunes:key`, giving Japanese Kanji and other foreign tracks instant, syllable-accurate romaji karaoke sweep with zero external enrichment calls.
- **Lyrics Typography & Layout QoL (`Settings -> LYRICS`)**: Added Rust-persisted **Font Style** (`Display / Sora`, `Clean Sans / Inter`, `Editorial / Libre Caslon`, `Studio Mono / JetBrains Mono`), **Text Size** (`Small`, `Medium`, `Large`, `Extra Large`), and **Split View Side** (`Lyrics Right` or `Lyrics Left`).
- **Auto-Romanize Foreign Scripts**: Added `lyricsAutoRomanize` (enabled by default) to automatically switch non-Latin songs (Japanese, Korean, Punjabi, Hindi, Chinese, Russian, etc.) to in-place romanized lyrics while keeping per-track `Rom` (`R`) toggle support. Translation (`Tr` / `Shift+T`) remains strictly manual and never auto-translates.

### Changed

- **Larger Responsive Idle Turntable**: Upgraded `MainView` turntable scaling to respond smoothly to viewport height/width (Pure Idle up to `1.56x`, Split Idle up to `1.34x`, Strip Idle up to `1.24x`) so the record fills fullscreen idle rooms generously without clipping on smaller windows.
- **Optical Center-Axis Lyrics Alignment**: Tuned Split View spacers and focal target (`44%` optical axis) so active lyrics align naturally beside the turntable instead of starting below it.
- **Uniform Settings Dialog Frame**: Locked `.settings-panel` to one consistent width and height across all 6 tabs (`LOOK`, `VINYL`, `LYRICS`, `DISPLAY`, `OTHER`, `ABOUT`) with smooth internal scrolling so switching to `LYRICS` never jumps the dialog height or clips controls.

### Fixed

- **Fixed Japanese Single-Line Romaji Paragraph Dump**: Added `isSaneRomanization` length-ratio guard, native TTML `<iTunesMetadata>` extraction, and bumped lyrics/enrichment cache keys to `v3`.
- **Fixed Noir vs. Glass Theme Swatch Shape Discrepancy**: Updated `.theme-picker__shell--glass` in `src/styles/global.css` and `.settings-shell-card--glass .settings-shell-card__disc` in `src/components/Settings/Settings.css` to `border-radius: 50%` so both Noir and Glass swatches are identical full circles.

## v2.1.1

### Added

- **Instant Offline Multi-Script Romanizer (`src/lib/lyrics/romanize.ts`)**: Zero-dependency, instant romanization for Korean Hangul (Revised Romanization), Japanese Hiragana & Katakana (Modified Hepburn), Punjabi Gurmukhi, and Hindi Devanagari, plus proportional karaoke word alignment so romanized lyrics retain 60fps word-by-word sweep.
- **3-Dot Instrumental Gap Interludes (`• • •`)**: Automatically displays 3 sequentially glowing progress dots during intro silences (`>= 1.2s`) and inter-line musical breaks (`>= 3.0s`) in both Split View and Compact Strip, driven at 60fps inside `useLyricsSync`.
- **Dedicated `LYRICS` Settings Tab**: Moved all Realtime Lyrics preferences (`Show Lyrics`, `Stage Layout`, `Romanized Lyrics`, `Translated Lyrics`, and `Translation Language`) out of `DISPLAY` into a dedicated `LYRICS` section (`LOOK | VINYL | LYRICS | DISPLAY | OTHER | ABOUT`).

### Changed

- **Romanization Replaces Primary Lyrics**: Enabling `Rom` (`R`) on non-Latin tracks now replaces the main lyric lines in-place (keeping word-by-word karaoke sweep intact), while `Tr` (`Shift+T`) stays cleanly stacked underneath as a translation subtitle.
- **Per-Line Bounded-Concurrency Enrichment**: Switched Rust `cmd_lyrics_enrich` and the browser fallback from multi-line chunking to per-line bounded-concurrency requests (`MAX_CONCURRENT_ENRICH = 5`) with automatic chorus deduplication, guaranteeing exact 1:1 line alignment across Kanji, Chinese, Arabic, Cyrillic, and other scripts.
- **Tucked Background Vocal Hierarchy**: Refined background vocals (`isBackground` / TTML `ttm:role="x-bg"`) to crisp, smaller non-italic typography tucked tightly beneath their lead vocal line.
- **Slimmed Right-Click Context Menu**: Focused the custom context menu on essential actions (`Play/Pause`, `Previous`, `Next`, `Show/Hide Lyrics`, `Art Ambient`, `Fullscreen`, `Mini Player`, `Settings`, `Quit`), keeping detailed lyrics controls in the utility strip, shortcuts, and `Settings -> LYRICS`.

### Fixed

- **Eliminated Per-Word Karaoke Flickering**: Replaced single-layer `color: transparent` + `-webkit-background-clip: text` + `filter: drop-shadow` transitions with a 2-layer word structure (always-rasterized `.lyrics-word__base` + alpha-masked `.lyrics-word__fill`), eliminating single-frame disappearing words in WebView2/Chromium.
- **Fixed Multi-Line Romanization Paragraph Dump**: Eliminated the bug where Google Translate `gtx` (`dt=rm`) collapsed newlines across chunks and placed an entire song's romanization onto line 0.
- **Fixed Nested TTML Background Vocals**: Updated `parseTtmlLyrics` to recurse into `<span ttm:role="x-bg">` wrapper spans so nested timed background words preserve their `isBackground` flag.
- **Fixed Lingering Focus Box on Clicked Lyric Lines**: Blurred lyric buttons on pointer clicks (`event.detail > 0`) while preserving `:focus-visible` outlines for keyboard Tab navigation.

## v2.1

### Added

- **Realtime Lyrics (Split View & Compact Strip)**: Word-by-word 60fps karaoke sweep (LyricsPlus & BetterLyrics TTML) with automatic line-synced (LRCLIB) and plain-text fallbacks, click-to-seek, and manual-scroll Recenter.
- **Zero-Key Romanized & Translated Lyrics**: Native transliteration/translation extraction from LyricsPlus v2 JSON and Apple Music TTML plus a Rust `cmd_lyrics_enrich` backend command, smart non-Latin script and same-language suppression guards, `Rom` / `Tr` utility controls, `R` and `Shift+T` shortcuts, and a 12-language selector.
- **Auto-Hide for Instrumental & No-Lyrics Tracks**: Automatically glides back to centered Pure Vinyl when a track has no vocals, while preserving the user's lyrics preference for the next vocal track and surfacing status via the top-right lyrics tooltip.
- **Unified Stage & Lean-Back Choreography**: Collapsible idle chrome dock and GPU-scaled vinyl slot keep the vinyl and active lyric line locked on the exact `50vh` horizontal center axis across Pure Vinyl, Split View, and Compact Strip without interrupting spin angle; corner chrome fades cleanly on Lean-Back idle.

### Changed

- Replaced native `scrollTo` in Split View with a continuous damped-spring scroll integrator, exact `getBoundingClientRect()` centering, `50%` top/bottom spacers, `ResizeObserver` recentering, and staggered per-line focus transitions.
- Upgraded Compact Strip line transitions to spring-choreographed `motion` animations.
- Removed manual millisecond latency offset controls (`-500 / -100 / 0 ms / +100 / +500` and `[` / `]`) to keep the lyrics utility bar focused and clutter-free.
- Unified all lyrics utility controls and Recenter button with VinylDeck's `<Tooltip>` and `<Kbd>` system across Noir and Glass themes.

### Fixed

- Eliminated the white left-edge gradient sliver on upcoming words.
- Fixed active lyric lines drifting into the bottom fade mask in Split View and dead bottom space in Idle Compact Strip.
- Fixed inline Apple Music TTML `x-roman` and `x-translation` spans leaking into primary lyric text during XML parsing.

## 0.1.1 - 2026-07-03

### Changed

- Reframed public documentation so `README.md` and user-facing docs describe VinylDeck as a product instead of an internal progress report.
- Moved implementation status language into maintainer and release documentation where it belongs.
- Mini player is now shrink-resizable from `280x280` down to `140x140`, with proportional vinyl/control scaling and compact track text fade-out.

### Added

- Opt-in Start With Windows setting backed by Tauri autostart.
- Resizable Mini player window with optional Mini Transparency backed by native Windows Acrylic.

### Verified

- Built release MSI and NSIS installers.
- Installed MSI successfully on Windows.
- Confirmed Control Panel entry and custom install location.

## 0.1.0 - 2026-06-14

### Added

- Windows Tauri shell for VinylDeck.
- Real SMTC media snapshots, artwork, capabilities, and in-app controls.
- Cached SMTC polling bridge with semantic-change events and position resyncs.
- Backend-owned settings authority with cross-window sync.
- Main, fullscreen, and mini window modes.
- Tray lifecycle and focused keyboard shortcuts.
- Noir and Glass visual shells.
- Album-art ambient color extraction.
- CSS vinyl deck renderer with animated record, tonearm, progress, and controls.
- Tooltips, keycap hints, context menu, directional track text, and in-place vinyl skip impulse.
- Standard documentation set: README, architecture, API, development guide, user guide, troubleshooting, release notes, changelog, and `llms.txt`.
