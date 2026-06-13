// src/components/ThemePicker/index.tsx
// Shell + ambient mode selector. Two rooms, multiple lighting scenes.

import { motion } from "motion/react";
import {
  AMBIENT_MODE_IDS,
  AMBIENT_MODE_LABELS,
  THEME_IDS,
  THEME_LABELS,
  applyVisualMode,
  resetAmbientColors,
} from "../../lib/themes/applier";
import type { AmbientModeId, ThemeId } from "../../lib/themes/applier";
import { useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings } from "../../lib/settings";

const SHELL_ACCENT: Record<ThemeId, string> = {
  noir: "#f1efea",
  glass: "#0070d9",
};

const SHELL_BG: Record<ThemeId, string> = {
  noir: "#050505",
  glass: "#f5f2ea",
};

const MODE_ACCENT: Record<AmbientModeId, string> = {
  off: "#7d7d7d",
  beam: "#f1d8b8",
  caustic: "#69d9ff",
  aurora: "#9c62ff",
};

const MODE_SHORT_LABEL: Record<AmbientModeId, string> = {
  off: "OFF",
  beam: "BEAM",
  caustic: "CAUS",
  aurora: "AUR",
};

export function ThemePicker() {
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const ambientMode = useVinylDeckStore((s) => s.ambientMode);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);

  function applyCommittedSettings(
    settings: Awaited<ReturnType<typeof commitSettings>>,
  ) {
    hydrateSettings(settings);
    applyVisualMode(settings.theme, settings.ambientMode);
    if (settings.ambientMode === "off") resetAmbientColors();
  }

  function handleThemeSelect(id: ThemeId) {
    void commitSettings({ theme: id })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Theme update failed:", error);
      });
  }

  function handleAmbientSelect(id: AmbientModeId) {
    if (id === "off") resetAmbientColors();
    void commitSettings({ ambientMode: id, artAmbient: id !== "off" })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Ambient mode update failed:", error);
      });
  }

  return (
    <div
      className="theme-picker"
      role="group"
      aria-label="Visual shell and ambient mode"
      style={{ display: "flex", gap: "10px", alignItems: "center" }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {THEME_IDS.map((id) => {
          const active = id === currentTheme;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${THEME_LABELS[id]} shell`}
              title={`${THEME_LABELS[id]} shell`}
              onClick={() => handleThemeSelect(id)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: id === "glass" ? "13px" : "50%",
                background:
                  id === "glass"
                    ? "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.22))"
                    : SHELL_BG[id],
                border: `2px solid ${active ? SHELL_ACCENT[id] : "rgba(255,255,255,0.12)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "border-color 200ms ease, border-radius 240ms ease",
                backdropFilter:
                  id === "glass" ? "blur(14px) saturate(1.6)" : undefined,
                WebkitBackdropFilter:
                  id === "glass" ? "blur(14px) saturate(1.6)" : undefined,
                boxShadow: active
                  ? `0 0 14px ${SHELL_ACCENT[id]}55, inset 0 0 10px ${SHELL_ACCENT[id]}22`
                  : "none",
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: SHELL_ACCENT[id],
                  opacity: active ? 1 : 0.44,
                  transition: "opacity 200ms ease",
                }}
              />
            </motion.button>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        style={{
          width: "1px",
          height: "18px",
          background: "color-mix(in srgb, var(--ui-border) 72%, transparent)",
          flexShrink: 0,
        }}
      />

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {AMBIENT_MODE_IDS.map((id) => {
          const active = id === ambientMode;
          return (
            <motion.button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={`${AMBIENT_MODE_LABELS[id]} ambient mode`}
              title={`${AMBIENT_MODE_LABELS[id]} ambient mode`}
              onClick={() => handleAmbientSelect(id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: id === "off" ? "34px" : "48px",
                height: "28px",
                padding: "0 9px",
                borderRadius: "999px",
                border: `1px solid ${active ? MODE_ACCENT[id] : "rgba(255,255,255,0.12)"}`,
                background: active
                  ? `color-mix(in srgb, ${MODE_ACCENT[id]} 16%, var(--ui-bg))`
                  : "color-mix(in srgb, var(--ui-bg) 54%, transparent)",
                color: active
                  ? "var(--ui-text-primary)"
                  : "var(--ui-text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: active ? `0 0 14px ${MODE_ACCENT[id]}55` : "none",
                backdropFilter: "var(--surface-backdrop)",
                WebkitBackdropFilter: "var(--surface-backdrop)",
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              {MODE_SHORT_LABEL[id]}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
