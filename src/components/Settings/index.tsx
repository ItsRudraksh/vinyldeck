import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { THEME_IDS, THEME_LABELS, applyTheme, resetAmbientColors } from "../../lib/themes/applier";
import type { ThemeId } from "../../lib/themes/applier";
import { selectSettings, useVinylDeckStore } from "../../lib/playback/store";
import { flushSettingsPersistence, writeSettingsHandoff } from "../../lib/settings";
import { setNativeAlwaysOnTop, setNativeWindowMode } from "../../lib/window";
import type { WindowMode } from "../../lib/window/types";
import "./Settings.css";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

const SETTINGS_TABS = ["THEMES", "VINYL", "DISPLAY", "ABOUT"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const THEME_CARD_META: Record<ThemeId, { bg: string; accent: string; note: string }> = {
  noir: { bg: "#131313", accent: "#e8e8e8", note: "OLED precision" },
  glass: { bg: "#f9f9fb", accent: "#0058bc", note: "Frosted light" },
  aurora: { bg: "#0e1419", accent: "#00d4be", note: "Cyan horizon" },
  vapor: { bg: "#111225", accent: "#c855ff", note: "Neon grid" },
  paper: { bg: "#fef9eb", accent: "#715230", note: "Bronze warmth" },
};

export function Settings({ open, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("THEMES");
  const settings = useVinylDeckStore(selectSettings);
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const setTheme = useVinylDeckStore((s) => s.setTheme);
  const artAmbient = useVinylDeckStore((s) => s.artAmbient);
  const setArtAmbient = useVinylDeckStore((s) => s.setArtAmbient);
  const updateSettings = useVinylDeckStore((s) => s.updateSettings);
  const setWindowMode = useVinylDeckStore((s) => s.setWindowMode);
  const setAlwaysOnTop = useVinylDeckStore((s) => s.setAlwaysOnTop);
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const setDevForceEmpty = useVinylDeckStore((s) => s.setDevForceEmpty);

  function handleThemeSelect(theme: ThemeId) {
    setTheme(theme);
    applyTheme(theme);
    if (theme !== "noir") resetAmbientColors();
  }

  function handleArtAmbientToggle() {
    const next = !artAmbient;
    setArtAmbient(next);
    if (!next) resetAmbientColors();
  }

  function handleWindowModeSelect(mode: WindowMode) {
    setWindowMode(mode);
    writeSettingsHandoff(useVinylDeckStore.getState().settings);
    void flushSettingsPersistence()
      .then(() => setNativeWindowMode(mode))
      .catch((error) => {
        console.warn("[Window] Mode change failed:", error);
      });
  }

  function handleAlwaysOnTopToggle() {
    const next = !settings.alwaysOnTop;
    setAlwaysOnTop(next);
    void setNativeAlwaysOnTop(next).catch((error) => {
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
              {activeTab === "THEMES" ? (
                <div className="settings-theme-grid" role="radiogroup" aria-label="Settings theme">
                  {THEME_IDS.map((theme) => {
                    const active = theme === currentTheme;
                    const meta = THEME_CARD_META[theme];

                    return (
                      <button
                        key={theme}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${THEME_LABELS[theme]} settings theme`}
                        className={`settings-theme-card${active ? " settings-theme-card--active" : ""}`}
                        onClick={() => handleThemeSelect(theme)}
                      >
                        <span
                          className="settings-theme-card__disc"
                          style={{
                            "--settings-card-bg": meta.bg,
                            "--settings-card-accent": meta.accent,
                          } as CSSProperties}
                          aria-hidden="true"
                        />
                        <span className="settings-theme-card__copy">
                          <span className="settings-theme-card__name">{THEME_LABELS[theme]}</span>
                          <span className="settings-theme-card__note">{meta.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : activeTab === "VINYL" ? (
                <div className="settings-toggle-list">
                  <SettingsToggle
                    label="Vinyl Wobble"
                    description="Subtle platter imperfection while playback is active."
                    checked={settings.vinylWobble}
                    onToggle={() => updateSettings({ vinylWobble: !settings.vinylWobble })}
                  />
                  {currentTheme === "noir" && (
                    <SettingsToggle
                      label="Album Art Ambient"
                      description="Let the record sleeve tint the Noir lighting field."
                      checked={artAmbient}
                      onToggle={handleArtAmbientToggle}
                    />
                  )}
                  <SettingsToggle
                    label="Film Grain"
                    description="Analog texture over the visual engine."
                    checked={settings.filmGrain}
                    onToggle={() => updateSettings({ filmGrain: !settings.filmGrain })}
                  />
                </div>
              ) : activeTab === "DISPLAY" ? (
                <div className="settings-toggle-list settings-display">
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">Window Mode</span>
                        <span className="settings-toggle-row__description">Switch between main, fullscreen, and mini player.</span>
                      </span>
                    </div>
                    <div className="settings-window-mode-grid" role="group" aria-label="Window mode">
                      {(["main", "fullscreen", "mini"] as const).map((mode) => {
                        const active = mode !== "mini" && settings.windowMode === mode;

                        return (
                          <button
                            key={mode}
                            type="button"
                            className={`settings-theme-card settings-window-mode-card${active ? " settings-theme-card--active" : ""}`}
                            onClick={() => handleWindowModeSelect(mode)}
                          >
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {mode === "main" ? "Main" : mode === "fullscreen" ? "Fullscreen" : "Mini"}
                              </span>
                              <span className="settings-theme-card__note">
                                {mode === "main" ? "Native shell" : mode === "fullscreen" ? "Lean-back view" : "280px widget"}
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
                      onToggle={() => updateSettings({ leanBackMode: !settings.leanBackMode })}
                    />
                    <SettingsToggle
                      label="Cursor Hide"
                      description="Hide the pointer when playback settles into idle."
                      checked={settings.cursorHide}
                      onToggle={() => updateSettings({ cursorHide: !settings.cursorHide })}
                    />
                  </div>
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">Idle Timeout</span>
                        <span className="settings-toggle-row__description">Delay before controls fade from view.</span>
                      </span>
                      <span className="settings-slider-row__value">{settings.idleTimeoutSeconds}s</span>
                    </div>
                    <input
                      className="settings-slider"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.idleTimeoutSeconds}
                      aria-label="Idle timeout"
                      onChange={(event) => updateSettings({ idleTimeoutSeconds: Number(event.currentTarget.value) })}
                    />
                    <div className="settings-slider-row__ticks" aria-hidden="true">
                      <span>1s</span>
                      <span>3s</span>
                      <span>5s</span>
                    </div>
                  </div>
                </div>
              ) : activeTab === "ABOUT" ? (
                <div className="settings-about">
                  <p className="settings-about__kicker">VinylDeck</p>
                  <h3>A cinematic vinyl experience for everything playing on your computer.</h3>
                  <div className="settings-about__grid" aria-label="Build details">
                    <span>Visual Engine</span>
                    <strong>Stage 2</strong>
                    <span>Shell</span>
                    <strong>Tauri v2</strong>
                    <span>Motion</span>
                    <strong>React 19</strong>
                    <span>Themes</span>
                    <strong>Noir / Glass / Aurora / Vapor / Paper</strong>
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
              ) : (
                <div className="settings-panel__placeholder">
                  <span className="settings-panel__disc" aria-hidden="true" />
                  <div>
                    <h3>Stage 9.4 Themes</h3>
                    <p>Controls land in the next pass.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SettingsToggle({ label, description, checked, onToggle }: SettingsToggleProps) {
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
      <span className={`settings-switch${checked ? " settings-switch--on" : ""}`} aria-hidden="true">
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

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  return <canvas className="settings-particles" ref={canvasRef} aria-hidden="true" />;
}
