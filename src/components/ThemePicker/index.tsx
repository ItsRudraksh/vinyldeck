// src/components/ThemePicker/index.tsx
// 5 theme selector buttons.
// Art Ambient toggle: Noir theme ONLY — hidden on all other themes.

import { motion } from "motion/react";
import { THEME_IDS, THEME_LABELS, applyTheme, resetAmbientColors } from "../../lib/themes/applier";
import type { ThemeId } from "../../lib/themes/applier";
import { useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings } from "../../lib/settings";

const THEME_ACCENT: Record<ThemeId, string> = {
  noir:   "#e8e8e8",
  glass:  "#a0c8ff",
  aurora: "#00d4be",
  vapor:  "#c855ff",
  paper:  "#d4a840",
};

const THEME_BG: Record<ThemeId, string> = {
  noir:   "#0e0e0f",
  glass:  "#1a1f2e",
  aurora: "#050d1a",
  vapor:  "#0b0c1f",
  paper:  "#1a1408",
};

export function ThemePicker() {
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const artAmbient   = useVinylDeckStore((s) => s.artAmbient);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);

  function applyCommittedSettings(settings: Awaited<ReturnType<typeof commitSettings>>) {
    hydrateSettings(settings);
    applyTheme(settings.theme);
    if (settings.theme !== "noir" || !settings.artAmbient) resetAmbientColors();
  }

  function handleSelect(id: ThemeId) {
    void commitSettings({ theme: id })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Theme update failed:", error);
      });
  }

  function handleAmbientToggle() {
    const next = !artAmbient;
    // Toggling OFF → immediately reset to theme defaults
    if (!next) resetAmbientColors();
    void commitSettings({ artAmbient: next })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Art ambient update failed:", error);
      });
  }

  const isNoir = currentTheme === "noir";

  return (
    <div
      role="radiogroup"
      aria-label="Visual theme"
      style={{ display: "flex", gap: "10px", alignItems: "center" }}
    >
      {/* ── Theme swatches ─────────────────────────────────── */}
      {THEME_IDS.map((id) => {
        const active = id === currentTheme;
        return (
          <motion.button
            key={id}
            role="radio"
            aria-checked={active}
            aria-label={`${THEME_LABELS[id]} theme`}
            onClick={() => handleSelect(id)}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: THEME_BG[id],
              border: `2px solid ${active ? THEME_ACCENT[id] : "rgba(255,255,255,0.12)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 200ms ease",
              boxShadow: active
                ? `0 0 12px ${THEME_ACCENT[id]}55, inset 0 0 8px ${THEME_ACCENT[id]}22`
                : "none",
            }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: THEME_ACCENT[id],
              opacity: active ? 1 : 0.4,
              transition: "opacity 200ms ease",
            }} />
          </motion.button>
        );
      })}

      {/* ── Art Ambient toggle — Noir ONLY ──────────────────── */}
      {isNoir && (
        <>
          <div style={{
            width: "1px",
            height: "18px",
            background: "rgba(255,255,255,0.10)",
            flexShrink: 0,
          }} />

          <motion.button
            onClick={handleAmbientToggle}
            aria-pressed={artAmbient}
            aria-label={`Album art ambient: ${artAmbient ? "on" : "off"}`}
            title="Album Art Ambient Color (Noir only)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px 4px 8px",
              borderRadius: "9999px",
              border: `1px solid ${artAmbient ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)"}`,
              background: artAmbient ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              cursor: "pointer",
              transition: "background 250ms ease, border-color 250ms ease",
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <div style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: artAmbient ? "#e8e8e8" : "rgba(255,255,255,0.22)",
              transition: "background 250ms ease",
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: artAmbient ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)",
              whiteSpace: "nowrap",
              transition: "color 250ms ease",
            }}>
              Art Ambient
            </span>
          </motion.button>
        </>
      )}

      {/* ── Current theme label ─────────────────────────────── */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--ui-text-secondary)",
        marginLeft: "2px",
      }}>
        {THEME_LABELS[currentTheme]}
      </span>
    </div>
  );
}
