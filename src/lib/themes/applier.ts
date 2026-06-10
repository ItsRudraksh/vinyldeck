// src/lib/themes/applier.ts
// Runtime theme switching via CSS custom property on <html>.
// Never triggers React re-renders — purely CSS.

export type ThemeId = "noir" | "glass" | "aurora" | "vapor" | "paper";

export const THEME_IDS: ThemeId[] = ["noir", "glass", "aurora", "vapor", "paper"];

export const THEME_LABELS: Record<ThemeId, string> = {
  noir: "Noir",
  glass: "Glass",
  aurora: "Aurora",
  vapor: "Vapor",
  paper: "Paper",
};

/**
 * Apply a theme by setting data-theme on <html>.
 * CSS custom properties in themes.css respond instantly.
 */
export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute("data-theme", themeId);
}

/**
 * Override ambient colors from artwork color extraction.
 * Called by useColorExtraction hook after fast-average-color analysis.
 */
export function applyAmbientColors(primary: string, secondary: string): void {
  const root = document.documentElement;
  root.style.setProperty("--ambient-primary", primary);
  root.style.setProperty("--ambient-secondary", secondary);
}

/**
 * Reset ambient colors back to theme defaults.
 * Called when no artwork is available.
 */
export function resetAmbientColors(): void {
  const root = document.documentElement;
  root.style.removeProperty("--ambient-primary");
  root.style.removeProperty("--ambient-secondary");
}
