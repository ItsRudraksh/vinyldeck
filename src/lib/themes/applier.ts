// src/lib/themes/applier.ts
// Runtime theme switching via CSS custom property on <html>.
// Never triggers React re-renders — purely CSS.

import type { VinylPressingType } from "../vinyl/pressingEngine";

export type ThemeId = "noir" | "glass" | "aurora" | "vapor" | "paper";

export const THEME_IDS: ThemeId[] = [
  "noir",
  "glass",
  "aurora",
  "vapor",
  "paper",
];

export const THEME_LABELS: Record<ThemeId, string> = {
  noir: "Noir",
  glass: "Glass",
  aurora: "Aurora",
  vapor: "Vapor",
  paper: "Paper",
};

const VINYL_PRESSING_CSS_VARS = [
  "--pressing-primary",
  "--pressing-secondary",
  "--pressing-accent",
  "--pressing-deep",
  "--pressing-soft",
  "--pressing-highlight",
  "--pressing-shadow",
  "--pressing-edge",
  "--pressing-pearl",
  "--pressing-groove",
  "--pressing-groove-bright",
  "--pressing-label-bg",
  "--pressing-seed-angle",
  "--pressing-seed-angle-alt",
  "--pressing-texture-opacity",
  "--pressing-translucency",
  "--pressing-splatter-scale",
  "--pressing-ghost-opacity",
  "--pressing-smoke-density",
  "--pressing-organic-x",
  "--pressing-organic-y",
  "--pressing-hash-a",
  "--pressing-hash-b",
] as const;

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
 * Called when no artwork is available or album-art ambient is disabled.
 */
export function resetAmbientColors(): void {
  const root = document.documentElement;
  root.style.removeProperty("--ambient-primary");
  root.style.removeProperty("--ambient-secondary");
}

/**
 * Apply deterministic collectible pressing parameters to CSS.
 * This keeps the React tree stable and lets the vinyl repaint through CSS only.
 */
export function applyVinylPressing(
  type: VinylPressingType,
  vars: Record<string, string>,
): void {
  const root = document.documentElement;
  root.setAttribute("data-vinyl-pressing", type);

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/**
 * Remove album-specific pressing overrides so theme defaults take over.
 */
export function resetVinylPressing(): void {
  const root = document.documentElement;
  root.removeAttribute("data-vinyl-pressing");

  for (const property of VINYL_PRESSING_CSS_VARS) {
    root.style.removeProperty(property);
  }
}
