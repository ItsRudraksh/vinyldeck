import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ART_AMBIENT_MODE,
  THEME_IDS,
  THEME_LABELS,
  applyVisualMode,
  resetAmbientColors,
} from "../../lib/themes/applier";
import type { ThemeId } from "../../lib/themes/applier";
import {
  LYRICS_FONT_FAMILIES,
  LYRICS_FONT_FAMILY_META,
  LYRICS_FONT_SIZES,
  LYRICS_FONT_SIZE_LABELS,
  LYRICS_SIDES,
  LYRICS_TARGET_LANG_LABELS,
  LYRICS_TARGET_LANGS,
  type LyricsTargetLang,
} from "../../lib/lyrics/types";
import { selectSettings, useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings } from "../../lib/settings";
import { setNativeAlwaysOnTop, setNativeWindowMode } from "../../lib/window";
import type { WindowMode } from "../../lib/window/types";
import "./Settings.css";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

const SETTINGS_TABS = [
  "LOOK",
  "VINYL",
  "LYRICS",
  "DISPLAY",
  "OTHER",
  "ABOUT",
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const SHELL_CARD_META: Record<
  ThemeId,
  { bg: string; accent: string; note: string; material: string }
> = {
  noir: {
    bg: "#000000",
    accent: "#f1efea",
    note: "OLED velvet room",
    material: "Matte black silk",
  },
  glass: {
    bg: "#f5f2ea",
    accent: "#0070d9",
    note: "Liquid display case",
    material: "Refractive glass",
  },
};

export function Settings({ open, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("LOOK");
  const settings = useVinylDeckStore(selectSettings);
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const ambientMode = useVinylDeckStore((s) => s.ambientMode);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const setDevForceEmpty = useVinylDeckStore((s) => s.setDevForceEmpty);

  function applyCommittedSettings(nextSettings: typeof settings) {
    hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
  }

  function updateBackendSettings(patch: Parameters<typeof commitSettings>[0]) {
    void commitSettings(patch)
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Update failed:", error);
      });
  }

  function handleThemeSelect(theme: ThemeId) {
    updateBackendSettings({ theme });
  }

  function handleArtAmbientToggle() {
    const nextMode = ambientMode === "off" ? ART_AMBIENT_MODE : "off";
    if (nextMode === "off") resetAmbientColors();
    updateBackendSettings({
      ambientMode: nextMode,
      artAmbient: nextMode !== "off",
    });
  }

  function handleWindowModeSelect(mode: WindowMode) {
    void commitSettings({ windowMode: mode })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeWindowMode(mode);
      })
      .catch((error) => {
        console.warn("[Window] Mode change failed:", error);
      });
  }

  function handleAlwaysOnTopToggle() {
    const next = !settings.alwaysOnTop;
    void commitSettings({ alwaysOnTop: next })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeAlwaysOnTop(next);
      })
      .catch((error) => {
        console.warn("[Window] Always-on-top change failed:", error);
      });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="settings-overlay"
          aria-modal="true"
          role="dialog"
          aria-label="VinylDeck settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            className="settings-overlay__scrim"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          />
          <SettingsParticles />

          <motion.section
            className={`settings-panel settings-panel--${activeTab.toLowerCase()}`}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="settings-panel__edge-light" aria-hidden="true" />
            <div className="settings-panel__sidebar">
              <p className="settings-panel__eyebrow">Preferences</p>
              <nav className="settings-nav" aria-label="Settings sections">
                {SETTINGS_TABS.map((tab) => {
                  const active = tab === activeTab;

                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`settings-nav__item${active ? " settings-nav__item--active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span className="settings-nav__rail" aria-hidden="true" />
                      <span>{tab}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="settings-panel__content">
              <p className="settings-panel__section-label">{activeTab}</p>
              {activeTab === "LOOK" ? (
                <div className="settings-look">
                  <div className="settings-look__section">
                    <div className="settings-look__header">
                      <h3>Shell</h3>
                      <p>Choose the physical room around the record.</p>
                    </div>
                    <div
                      className="settings-theme-grid settings-shell-grid"
                      role="radiogroup"
                      aria-label="Visual shell"
                    >
                      {THEME_IDS.map((theme) => {
                        const active = theme === currentTheme;
                        const meta = SHELL_CARD_META[theme];

                        return (
                          <button
                            key={theme}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={`${THEME_LABELS[theme]} shell`}
                            className={`settings-theme-card settings-shell-card settings-shell-card--${theme}${active ? " settings-theme-card--active" : ""}`}
                            onClick={() => handleThemeSelect(theme)}
                          >
                            <span
                              className="settings-theme-card__disc settings-shell-card__disc"
                              style={
                                {
                                  "--settings-card-bg": meta.bg,
                                  "--settings-card-accent": meta.accent,
                                } as CSSProperties
                              }
                              aria-hidden="true"
                            />
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {THEME_LABELS[theme]}
                              </span>
                              <span className="settings-theme-card__note">
                                {meta.note}
                              </span>
                              <span className="settings-card__material">
                                {meta.material}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-look__section">
                    <div className="settings-look__header">
                      <h3>Art Ambient</h3>
                      <p>
                        Small album-colour glow using the same palette as the
                        vinyl pressing.
                      </p>
                    </div>
                    <div className="settings-toggle-list settings-toggle-list--compact">
                      <SettingsToggle
                        label="Art Ambient"
                        description="Subtle primary, secondary, and accent glows behind the record. Shortcut: A."
                        checked={ambientMode !== "off"}
                        onToggle={handleArtAmbientToggle}
                      />
                    </div>
                  </div>
                </div>
              ) : activeTab === "VINYL" ? (
                <div className="settings-toggle-list">
                  <SettingsToggle
                    label="Vinyl Wobble"
                    description="Subtle platter imperfection while playback is active."
                    checked={settings.vinylWobble}
                    onToggle={() =>
                      updateBackendSettings({
                        vinylWobble: !settings.vinylWobble,
                      })
                    }
                  />
                  <SettingsToggle
                    label="Film Grain"
                    description="Analog texture over the visual engine."
                    checked={settings.filmGrain}
                    onToggle={() =>
                      updateBackendSettings({ filmGrain: !settings.filmGrain })
                    }
                  />
                </div>
              ) : activeTab === "LYRICS" ? (
                <div className="settings-toggle-list settings-lyrics">
                  <div className="settings-toggle-list settings-toggle-list--compact">
                    <SettingsToggle
                      label="Show Lyrics"
                      description="Stream synced word-by-word karaoke lyrics in Main and Fullscreen modes, with auto-hide on instrumentals. Shortcut: L."
                      checked={settings.lyricsEnabled}
                      onToggle={() =>
                        updateBackendSettings({
                          lyricsEnabled: !settings.lyricsEnabled,
                        })
                      }
                    />
                  </div>

                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Stage Layout & Side
                        </span>
                        <span className="settings-toggle-row__description">
                          Choose Split View or Compact Strip (Shift+L), and which side lyrics appear on in Split View.
                        </span>
                      </span>
                    </div>
                    <div
                      className="settings-lyrics-layout-grid"
                      role="group"
                      aria-label="Lyrics layout"
                    >
                      {(["split", "strip"] as const).map((layoutMode) => {
                        const active = settings.lyricsLayout === layoutMode;
                        return (
                          <button
                            key={layoutMode}
                            type="button"
                            className={`settings-theme-card settings-window-mode-card${active ? " settings-theme-card--active" : ""}`}
                            onClick={() =>
                              updateBackendSettings({
                                lyricsEnabled: true,
                                lyricsLayout: layoutMode,
                              })
                            }
                          >
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {layoutMode === "split"
                                  ? "Split View"
                                  : "Compact Strip"}
                              </span>
                              <span className="settings-theme-card__note">
                                {layoutMode === "split"
                                  ? "Vinyl beside lyrics"
                                  : "3-line focus below disc"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="settings-lyrics-layout-grid"
                      role="group"
                      aria-label="Split View lyrics side"
                      style={{ marginTop: "10px" }}
                    >
                      {LYRICS_SIDES.map((side) => {
                        const active = settings.lyricsSide === side;
                        return (
                          <button
                            key={side}
                            type="button"
                            className={`settings-size-chip${active ? " settings-size-chip--active" : ""}`}
                            onClick={() =>
                              updateBackendSettings({ lyricsSide: side })
                            }
                          >
                            {side === "right"
                              ? "Lyrics Right (Default)"
                              : "Lyrics Left"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Typography
                        </span>
                        <span className="settings-toggle-row__description">
                          Customize lyrics font style and scale across Split View and Compact Strip.
                        </span>
                      </span>
                    </div>
                    <div
                      className="settings-lyrics-font-grid"
                      role="group"
                      aria-label="Lyrics font family"
                    >
                      {LYRICS_FONT_FAMILIES.map((family) => {
                        const active = settings.lyricsFontFamily === family;
                        const meta = LYRICS_FONT_FAMILY_META[family];
                        return (
                          <button
                            key={family}
                            type="button"
                            className={`settings-theme-card settings-window-mode-card${active ? " settings-theme-card--active" : ""}`}
                            onClick={() =>
                              updateBackendSettings({ lyricsFontFamily: family })
                            }
                          >
                            <span className="settings-theme-card__copy">
                              <span
                                className="settings-theme-card__name"
                                style={{ fontFamily: meta.stack }}
                              >
                                {meta.label}
                              </span>
                              <span className="settings-theme-card__note">
                                {meta.note}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="settings-lyrics-size-row"
                      role="group"
                      aria-label="Lyrics text size"
                      style={{ marginTop: "10px" }}
                    >
                      {LYRICS_FONT_SIZES.map((size) => {
                        const active = settings.lyricsFontSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            className={`settings-size-chip${active ? " settings-size-chip--active" : ""}`}
                            onClick={() =>
                              updateBackendSettings({ lyricsFontSize: size })
                            }
                          >
                            {LYRICS_FONT_SIZE_LABELS[size]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Language Aids
                        </span>
                        <span className="settings-toggle-row__description">
                          Free, zero-key phonetic romanization (replaces main lyrics with karaoke sweep) and manual translations below.
                        </span>
                      </span>
                    </div>
                    <div className="settings-toggle-list settings-toggle-list--compact">
                      <SettingsToggle
                        label="Auto-Romanize Foreign Scripts"
                        description="Automatically romanize Japanese, Korean, Punjabi, Hindi, Chinese, Russian, and other non-Latin songs. Never auto-translates."
                        checked={settings.lyricsAutoRomanize}
                        onToggle={() =>
                          updateBackendSettings({
                            lyricsAutoRomanize: !settings.lyricsAutoRomanize,
                          })
                        }
                      />
                    </div>
                    <div className="settings-display__switch-grid settings-lyrics-subgrid">
                      <SettingsToggle
                        label="Romanized Lyrics"
                        description="Default romanization when Auto-Romanize is off. Shortcut: R."
                        checked={settings.lyricsRomanized}
                        onToggle={() =>
                          updateBackendSettings({
                            lyricsRomanized: !settings.lyricsRomanized,
                          })
                        }
                      />
                      <SettingsToggle
                        label="Translated Lyrics"
                        description="Manual only — show translated subtitles beneath each line. Shortcut: Shift+T."
                        checked={settings.lyricsTranslated}
                        onToggle={() =>
                          updateBackendSettings({
                            lyricsTranslated: !settings.lyricsTranslated,
                          })
                        }
                      />
                    </div>
                    <div className="settings-select-row">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Translation Language
                        </span>
                        <span className="settings-toggle-row__description">
                          Target language for manual translated subtitles. Tracks already in this language skip duplicates automatically.
                        </span>
                      </span>
                      <SettingsSelect
                        ariaLabel="Translation language"
                        value={settings.lyricsTargetLang}
                        options={LYRICS_TARGET_LANGS.map((code) => ({
                          value: code,
                          label: LYRICS_TARGET_LANG_LABELS[code],
                        }))}
                        onChange={(nextLang) =>
                          updateBackendSettings({
                            lyricsTargetLang: nextLang as LyricsTargetLang,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : activeTab === "DISPLAY" ? (
                <div className="settings-toggle-list settings-display">
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Window Mode
                        </span>
                        <span className="settings-toggle-row__description">
                          Switch between main, fullscreen, and mini player.
                        </span>
                      </span>
                    </div>
                    <div
                      className="settings-window-mode-grid"
                      role="group"
                      aria-label="Window mode"
                    >
                      {(["main", "fullscreen", "mini"] as const).map((mode) => {
                        const active =
                          mode !== "mini" && settings.windowMode === mode;

                        return (
                          <button
                            key={mode}
                            type="button"
                            className={`settings-theme-card settings-window-mode-card${active ? " settings-theme-card--active" : ""}`}
                            onClick={() => handleWindowModeSelect(mode)}
                          >
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {mode === "main"
                                  ? "Main"
                                  : mode === "fullscreen"
                                    ? "Fullscreen"
                                    : "Mini"}
                              </span>
                              <span className="settings-theme-card__note">
                                {mode === "main"
                                  ? "Native shell"
                                  : mode === "fullscreen"
                                    ? "Lean-back view"
                                    : "Resizable widget"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-display__switch-grid">
                    <SettingsToggle
                      label="Always On Top"
                      description="Keep VinylDeck above other windows."
                      checked={settings.alwaysOnTop}
                      onToggle={handleAlwaysOnTopToggle}
                    />
                    <SettingsToggle
                      label="Lean-Back Mode"
                      description="Let controls disappear while the record becomes the room."
                      checked={settings.leanBackMode}
                      onToggle={() =>
                        updateBackendSettings({
                          leanBackMode: !settings.leanBackMode,
                        })
                      }
                    />
                    <SettingsToggle
                      label="Cursor Hide"
                      description="Hide the pointer when playback settles into idle."
                      checked={settings.cursorHide}
                      onToggle={() =>
                        updateBackendSettings({
                          cursorHide: !settings.cursorHide,
                        })
                      }
                    />
                  </div>
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          Idle Timeout
                        </span>
                        <span className="settings-toggle-row__description">
                          Delay before controls fade from view.
                        </span>
                      </span>
                      <span className="settings-slider-row__value">
                        {settings.idleTimeoutSeconds}s
                      </span>
                    </div>
                    <input
                      className="settings-slider"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.idleTimeoutSeconds}
                      aria-label="Idle timeout"
                      onChange={(event) =>
                        updateBackendSettings({
                          idleTimeoutSeconds: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <div
                      className="settings-slider-row__ticks"
                      aria-hidden="true"
                    >
                      <span>1s</span>
                      <span>3s</span>
                      <span>5s</span>
                    </div>
                  </div>
                  <div className="settings-toggle-list settings-toggle-list--compact">
                    <SettingsToggle
                      label="Mini Transparency"
                      description="Mini only. Blurs your desktop through the player using Windows Acrylic; the vinyl and controls float over it. Mini can shrink from its 280px square down to a compact size."
                      checked={settings.miniTransparentMode}
                      onToggle={() =>
                        updateBackendSettings({
                          miniTransparentMode: !settings.miniTransparentMode,
                        })
                      }
                    />
                  </div>
                </div>
              ) : activeTab === "OTHER" ? (
                <div className="settings-toggle-list">
                  <SettingsToggle
                    label="Keyboard Shortcuts"
                    description="Use Space, arrows, and single-key actions while VinylDeck is focused."
                    checked={settings.keyboardShortcutsEnabled}
                    onToggle={() =>
                      updateBackendSettings({
                        keyboardShortcutsEnabled:
                          !settings.keyboardShortcutsEnabled,
                      })
                    }
                  />
                  <SettingsToggle
                    label="Quit To Tray"
                    description="Keep VinylDeck available from the tray when closing the player window."
                    checked={settings.quitToTray}
                    onToggle={() =>
                      updateBackendSettings({
                        quitToTray: !settings.quitToTray,
                      })
                    }
                  />
                  <SettingsToggle
                    label="Start With Windows"
                    description="Launch VinylDeck automatically when you sign in."
                    checked={settings.startWithWindows}
                    onToggle={() =>
                      updateBackendSettings({
                        startWithWindows: !settings.startWithWindows,
                      })
                    }
                  />
                </div>
              ) : activeTab === "ABOUT" ? (
                <div className="settings-about">
                  <p className="settings-about__kicker">VinylDeck</p>
                  <h3>
                    A focused desktop player that turns whatever is playing on
                    your computer into a living vinyl deck.
                  </h3>
                  <p className="settings-about__body">
                    VinylDeck follows your system media session, reacts to album
                    art, streams realtime synced lyrics, and keeps a beautiful
                    record-player view close by without taking over your
                    workspace.
                  </p>
                  <div
                    className="settings-about__grid"
                    aria-label="App details"
                  >
                    <span>Version</span>
                    <strong>2.3.2</strong>
                    <span>Playback</span>
                    <strong>System media</strong>
                    <span>Windows</span>
                    <strong>Main, fullscreen, mini</strong>
                    <span>Visuals</span>
                    <strong>Noir, Glass, Art Ambient</strong>
                  </div>
                  <div className="settings-about__qa">
                    <SettingsToggle
                      label="Test Empty State"
                      description="Force the no-media visual state for inspection."
                      checked={devForceEmpty}
                      onToggle={() => setDevForceEmpty(!devForceEmpty)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


interface SettingsSelectOption {
  value: string;
  label: string;
}

interface SettingsSelectProps {
  ariaLabel: string;
  value: string;
  options: SettingsSelectOption[];
  onChange: (value: string) => void;
}

function SettingsSelect({
  ariaLabel,
  value,
  options,
  onChange,
}: SettingsSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  return (
    <div className="settings-custom-select" ref={rootRef}>
      <button
        type="button"
        className="settings-custom-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{activeOption?.label ?? value}</span>
        <svg
          className="settings-custom-select__chevron"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="settings-custom-select__menu"
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`settings-custom-select__option${selected ? " settings-custom-select__option--active" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {selected && (
                    <svg
                      className="settings-custom-select__check"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SettingsToggle({
  label,
  description,
  checked,
  onToggle,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      className="settings-toggle-row"
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className="settings-toggle-row__copy">
        <span className="settings-toggle-row__label">{label}</span>
        <span className="settings-toggle-row__description">{description}</span>
      </span>
      <span
        className={`settings-switch${checked ? " settings-switch--on" : ""}`}
        aria-hidden="true"
      >
        <span className="settings-switch__glow" />
        <span className="settings-switch__thumb" />
      </span>
    </button>
  );
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

function SettingsParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const canvasEl = canvas;
    const ctx = context;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frameId = 0;
    let particles: Particle[] = [];

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvasEl.width = Math.round(window.innerWidth * ratio);
      canvasEl.height = Math.round(window.innerHeight * ratio);
      canvasEl.style.width = `${window.innerWidth}px`;
      canvasEl.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resetParticles() {
      particles = Array.from({ length: 25 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 1 + Math.random(),
        speed: 0.18 + Math.random() * 0.34,
        alpha: 0.12 + Math.random() * 0.08,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";

      for (const particle of particles) {
        particle.y -= particle.speed;
        if (particle.y < -4) {
          particle.y = window.innerHeight + 4;
          particle.x = Math.random() * window.innerWidth;
        }

        ctx.globalAlpha = particle.alpha;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    }

    resize();
    resetParticles();
    window.addEventListener("resize", resize);

    if (!prefersReducedMotion) {
      frameId = window.requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas className="settings-particles" ref={canvasRef} aria-hidden="true" />
  );
}
