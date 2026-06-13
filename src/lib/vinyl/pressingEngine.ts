// src/lib/vinyl/pressingEngine.ts
// Deterministic album-art → physical vinyl pressing engine.
// Third pass: material recipes for the hybrid Canvas/WebGL Pressing Studio
// while keeping CSS variables for the second-pass fallback renderer.

export type VinylPressingType =
  | "solid"
  | "marble"
  | "splatter"
  | "translucent"
  | "dual-tone"
  | "smoke"
  | "audiophile-black";

export type VinylPressingRecipe =
  | "opaque-solid"
  | "clear-tint"
  | "smoke-clear"
  | "marble-blend"
  | "splatter"
  | "color-in-color"
  | "merge"
  | "galaxy"
  | "audiophile-black";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
}

export interface ArtworkPaletteCharacteristics {
  averageSaturation: number;
  averageLightness: number;
  contrast: number;
  hueSpread: number;
  isAchromatic: boolean;
  isNearlyBlack: boolean;
  isNearlyWhite: boolean;
  isWarm: boolean;
  isDark: boolean;
  isLight: boolean;
  isHighContrast: boolean;
  isColorfulMultiTone: boolean;
}

export interface ArtworkPalette {
  primary: RgbColor;
  secondary: RgbColor;
  accent: RgbColor;
  average: RgbColor;
  characteristics: ArtworkPaletteCharacteristics;
}

export interface VinylShaderMaterial {
  recipeId: number;
  translucency: number;
  roughness: number;
  grooveIntensity: number;
  diffraction: number;
  rimAbsorption: number;
  textureScale: number;
  splatterDensity: number;
  marbleFlow: number;
  smokeDensity: number;
  alpha: number;
}

export interface VinylPressing {
  /** CSS fallback pressing family. */
  type: VinylPressingType;
  /** Manufacturing-inspired material recipe used by the WebGL renderer. */
  recipe: VinylPressingRecipe;
  /** Human/collector-friendly internal name. */
  pressingName: string;
  seed: string;
  seedHash: number;
  colors: {
    primary: RgbColor;
    secondary: RgbColor;
    accent: RgbColor;
    deep: RgbColor;
    highlight: RgbColor;
    edge: RgbColor;
  };
  material: VinylShaderMaterial;
  /** Existing CSS custom properties for fallback and wrapper effects. */
  cssVars: Record<string, string>;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const FALLBACK_PRIMARY = colorFromRgb(18, 18, 18);
const FALLBACK_SECONDARY = colorFromRgb(214, 214, 214);
const FALLBACK_ACCENT = colorFromRgb(150, 18, 36);
const WHITE = colorFromRgb(255, 255, 255);
const BLACK = colorFromRgb(0, 0, 0);

export function createFallbackPalette(): ArtworkPalette {
  return buildPalette(
    FALLBACK_PRIMARY,
    FALLBACK_SECONDARY,
    FALLBACK_ACCENT,
    FALLBACK_PRIMARY,
  );
}

export function buildPalette(
  primary: RgbColor,
  secondary: RgbColor,
  accent: RgbColor,
  average: RgbColor,
): ArtworkPalette {
  const primarySecondaryDistance = colorDistance(primary, secondary);
  const primaryAccentDistance = colorDistance(primary, accent);
  const secondaryAccentDistance = colorDistance(secondary, accent);
  const lightnessContrast = Math.max(
    Math.abs(primary.l - secondary.l),
    Math.abs(primary.l - accent.l),
    Math.abs(secondary.l - accent.l),
  );
  const contrast = Math.max(
    primarySecondaryDistance,
    primaryAccentDistance,
    secondaryAccentDistance,
    lightnessContrast,
  );
  const hueSpread =
    Math.max(
      hueDistance(primary.h, secondary.h),
      hueDistance(primary.h, accent.h),
      hueDistance(secondary.h, accent.h),
    ) / 180;

  const averageSaturation =
    primary.s * 0.48 + secondary.s * 0.3 + accent.s * 0.22;
  const averageLightness =
    primary.l * 0.46 + secondary.l * 0.24 + accent.l * 0.12 + average.l * 0.18;
  const warmScore = warmth(primary) + warmth(accent) * 0.5;
  const isAchromatic =
    averageSaturation < 0.16 &&
    primary.s < 0.22 &&
    secondary.s < 0.22 &&
    accent.s < 0.26;
  const isNearlyBlack = averageLightness < 0.2 && averageSaturation < 0.22;
  const isNearlyWhite = averageLightness > 0.74 && averageSaturation < 0.22;
  const isColorfulMultiTone =
    averageSaturation > 0.25 && hueSpread > 0.22 && contrast > 0.24;

  return {
    primary,
    secondary,
    accent,
    average,
    characteristics: {
      averageSaturation,
      averageLightness,
      contrast,
      hueSpread,
      isAchromatic,
      isNearlyBlack,
      isNearlyWhite,
      isWarm: warmScore > 0.4,
      isDark: averageLightness < 0.3,
      isLight: averageLightness > 0.64,
      isHighContrast: contrast > 0.42 || lightnessContrast > 0.38,
      isColorfulMultiTone,
    },
  };
}

export function colorFromRgb(r: number, g: number, b: number): RgbColor {
  const rr = Math.round(clamp(r, 0, 255));
  const gg = Math.round(clamp(g, 0, 255));
  const bb = Math.round(clamp(b, 0, 255));
  const [h, s, l] = rgbToHsl(rr, gg, bb);
  return {
    r: rr,
    g: gg,
    b: bb,
    hex: rgbToHex(rr, gg, bb),
    h,
    s,
    l,
  };
}

export function deriveVinylPressing(
  palette: ArtworkPalette,
  seedInput: string,
): VinylPressing {
  const seed = normalizeSeed(seedInput);
  const seedHash = hashString(
    `${seed}|${palette.primary.hex}|${palette.secondary.hex}|${palette.accent.hex}|v3-webgl-material`,
  );
  const roll = seededUnit(seedHash);
  const recipe = choosePressingRecipe(palette, roll, seedHash);
  const type = fallbackTypeForRecipe(recipe);
  const c = palette.characteristics;

  const primary = preparePrimaryColor(
    palette.primary,
    palette.average,
    type,
    c,
  );
  const secondary = prepareSecondaryColor(palette.secondary, primary, type, c);
  const accent = prepareAccentColor(palette.accent, primary, type, c, seedHash);

  const angle = 12 + Math.round(seededUnit(seedHash ^ 0x7f4a7c15) * 336);
  const angleAlt =
    (angle + 104 + Math.round(seededUnit(seedHash ^ 0x5f356495) * 96)) % 360;
  const splatterScale = 0.7 + seededUnit(seedHash ^ 0x9e3779b9) * 0.88;
  const textureOpacity = textureOpacityFor(type, c, seedHash);
  const translucentAlpha = translucencyFor(type, c, seedHash);

  const material = createShaderMaterial(recipe, type, c, seedHash);
  const colorSet = createColorSet(type, primary, secondary, accent);

  const cssVars = createCssVars({
    type,
    primary,
    secondary,
    accent,
    angle,
    angleAlt,
    splatterScale,
    textureOpacity,
    translucentAlpha,
    hash: seedHash,
    characteristics: c,
    material,
    recipe,
  });

  return {
    type,
    recipe,
    pressingName: createPressingName(
      recipe,
      primary,
      secondary,
      accent,
      c,
      seedHash,
    ),
    seed,
    seedHash,
    colors: colorSet,
    material,
    cssVars,
  };
}

function choosePressingRecipe(
  palette: ArtworkPalette,
  roll: number,
  hash: number,
): VinylPressingRecipe {
  const { primary, secondary, accent, characteristics: c } = palette;
  const neutralSecondary = secondary.s < 0.18 && secondary.l > 0.58;
  const brightNeutralAccent = accent.s < 0.24 && accent.l > 0.72;
  const veryClosePalette =
    colorDistance(primary, secondary) < 0.16 &&
    colorDistance(primary, accent) < 0.2;
  const twoColorIdentity = c.contrast > 0.34 && c.hueSpread > 0.16;
  const organicRoll = seededUnit(hash ^ 0x165667b1);
  const blueNight =
    c.isDark &&
    c.averageSaturation > 0.18 &&
    primary.h >= 175 &&
    primary.h <= 285;

  // Neutral art gets curated material behavior instead of collapsing to flat black.
  if (c.isAchromatic) {
    if (c.isNearlyWhite)
      return organicRoll > 0.42 ? "clear-tint" : "smoke-clear";
    if (c.isNearlyBlack)
      return organicRoll > 0.58 ? "smoke-clear" : "audiophile-black";
    if (c.contrast > 0.26)
      return organicRoll > 0.32 ? "smoke-clear" : "marble-blend";
    return organicRoll > 0.56 ? "clear-tint" : "smoke-clear";
  }

  if (blueNight && organicRoll > 0.42) return "galaxy";

  // High contrast plus a pale/neutral secondary should become obvious collector splatter.
  if (
    c.isHighContrast &&
    (neutralSecondary ||
      brightNeutralAccent ||
      Math.abs(primary.l - secondary.l) > 0.34)
  ) {
    if (roll < 0.64) return "splatter";
    return twoColorIdentity ? "merge" : "marble-blend";
  }

  // Colorful covers should usually become special pressings, not safe solids.
  if (c.isColorfulMultiTone) {
    if (roll < 0.32) return "marble-blend";
    if (roll < 0.58) return "splatter";
    if (roll < 0.78) return "color-in-color";
    return twoColorIdentity ? "merge" : "marble-blend";
  }

  // Pale and airy covers are glass/clear candidates.
  if (
    (c.isLight && c.averageSaturation < 0.46) ||
    (primary.l > 0.5 && secondary.l > 0.45 && roll > 0.38)
  ) {
    return organicRoll > 0.46 ? "clear-tint" : "color-in-color";
  }

  // Dark colorful covers should be smoke/galaxy before black.
  if (c.isDark && c.averageSaturation > 0.18) {
    if (roll < 0.42) return "smoke-clear";
    if (primary.h >= 175 && primary.h <= 285 && roll < 0.72) return "galaxy";
    return c.hueSpread > 0.18 ? "marble-blend" : "opaque-solid";
  }

  if (twoColorIdentity && roll > 0.52) return "merge";

  if (veryClosePalette || (c.contrast < 0.2 && primary.s > 0.2)) {
    return roll < 0.52 ? "opaque-solid" : "clear-tint";
  }

  if (roll < 0.16) return "opaque-solid";
  if (roll < 0.52) return "marble-blend";
  if (roll < 0.74) return "splatter";
  if (roll < 0.88) return "color-in-color";
  return "merge";
}

function fallbackTypeForRecipe(recipe: VinylPressingRecipe): VinylPressingType {
  switch (recipe) {
    case "opaque-solid":
      return "solid";
    case "clear-tint":
    case "color-in-color":
      return "translucent";
    case "smoke-clear":
    case "galaxy":
      return "smoke";
    case "marble-blend":
      return "marble";
    case "splatter":
      return "splatter";
    case "merge":
      return "dual-tone";
    case "audiophile-black":
      return "audiophile-black";
  }
}

export function recipeIdFor(recipe: VinylPressingRecipe): number {
  switch (recipe) {
    case "opaque-solid":
      return 0;
    case "clear-tint":
      return 1;
    case "smoke-clear":
      return 2;
    case "marble-blend":
      return 3;
    case "splatter":
      return 4;
    case "color-in-color":
      return 5;
    case "merge":
      return 6;
    case "galaxy":
      return 7;
    case "audiophile-black":
      return 8;
  }
}

function createShaderMaterial(
  recipe: VinylPressingRecipe,
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): VinylShaderMaterial {
  const jitter = seededUnit(hash ^ 0x91e10da5);
  const jitterB = seededUnit(hash ^ 0x43c6a1f7);

  const base: VinylShaderMaterial = {
    recipeId: recipeIdFor(recipe),
    translucency: 0.03,
    roughness: 0.34,
    grooveIntensity: 0.72,
    diffraction: 0.1,
    rimAbsorption: 0.32,
    textureScale: 1.0 + jitter * 0.45,
    splatterDensity: 0.42,
    marbleFlow: 0.42,
    smokeDensity: 0.34,
    alpha: 1,
  };

  switch (recipe) {
    case "opaque-solid":
      return {
        ...base,
        roughness: 0.32 + jitter * 0.14,
        grooveIntensity: 0.72,
        diffraction: 0.08 + jitter * 0.05,
        rimAbsorption: 0.34,
      };
    case "clear-tint":
      return {
        ...base,
        translucency: clamp(
          (c.isNearlyWhite ? 0.62 : 0.5) + jitter * 0.12,
          0.46,
          0.76,
        ),
        roughness: 0.2 + jitter * 0.12,
        grooveIntensity: 0.84,
        diffraction: 0.18 + jitterB * 0.12,
        rimAbsorption: 0.52 + jitter * 0.16,
        alpha: 0.68 + jitterB * 0.14,
      };
    case "smoke-clear":
      return {
        ...base,
        translucency: clamp(
          (c.isDark ? 0.58 : 0.68) + jitter * 0.12,
          0.48,
          0.82,
        ),
        roughness: 0.28 + jitterB * 0.18,
        grooveIntensity: 0.78,
        diffraction: 0.14 + jitter * 0.1,
        rimAbsorption: c.isDark ? 0.62 : 0.48,
        smokeDensity: 0.58 + jitter * 0.26,
        alpha: c.isDark ? 0.78 : 0.7,
      };
    case "marble-blend":
      return {
        ...base,
        roughness: 0.42 + jitter * 0.16,
        grooveIntensity: 0.68,
        diffraction: 0.1 + jitterB * 0.1,
        rimAbsorption: 0.4,
        marbleFlow: 0.62 + jitter * 0.28,
        textureScale: 1.1 + jitterB * 0.75,
      };
    case "splatter":
      return {
        ...base,
        roughness: 0.38 + jitter * 0.18,
        grooveIntensity: 0.66,
        diffraction: 0.12 + jitter * 0.08,
        rimAbsorption: 0.38,
        splatterDensity: 0.54 + jitterB * 0.34,
        textureScale: 0.9 + jitter * 0.85,
      };
    case "color-in-color":
      return {
        ...base,
        translucency: 0.42 + jitter * 0.18,
        roughness: 0.26 + jitterB * 0.12,
        grooveIntensity: 0.78,
        diffraction: 0.16 + jitter * 0.13,
        rimAbsorption: 0.48,
        marbleFlow: 0.5 + jitterB * 0.22,
        alpha: 0.74 + jitter * 0.12,
      };
    case "merge":
      return {
        ...base,
        roughness: 0.34 + jitter * 0.14,
        grooveIntensity: 0.7,
        diffraction: 0.11 + jitterB * 0.08,
        rimAbsorption: 0.38,
        marbleFlow: 0.46 + jitter * 0.16,
      };
    case "galaxy":
      return {
        ...base,
        translucency: 0.32 + jitter * 0.12,
        roughness: 0.36 + jitter * 0.18,
        grooveIntensity: 0.76,
        diffraction: 0.22 + jitterB * 0.18,
        rimAbsorption: 0.68,
        smokeDensity: 0.52 + jitter * 0.28,
        alpha: 0.86,
      };
    case "audiophile-black":
      return {
        ...base,
        roughness: 0.48 + jitter * 0.16,
        grooveIntensity: 0.86,
        diffraction: 0.07,
        rimAbsorption: 0.48,
        textureScale: 0.85 + jitter * 0.2,
      };
  }
}

function createColorSet(
  type: VinylPressingType,
  primary: RgbColor,
  secondary: RgbColor,
  accent: RgbColor,
): VinylPressing["colors"] {
  const deepShift =
    type === "audiophile-black" ? -0.24 : type === "translucent" ? -0.12 : -0.2;
  const deep = shiftLightness(primary, deepShift);
  const highlight = shiftLightness(
    desaturate(primary, 0.08),
    type === "translucent" ? 0.36 : 0.24,
  );
  const shadow = shiftLightness(primary, type === "smoke" ? -0.28 : -0.34);
  const edge = mixColors(shadow, BLACK, type === "translucent" ? 0.22 : 0.42);

  return { primary, secondary, accent, deep, highlight, edge };
}

function createCssVars(input: {
  type: VinylPressingType;
  recipe: VinylPressingRecipe;
  primary: RgbColor;
  secondary: RgbColor;
  accent: RgbColor;
  angle: number;
  angleAlt: number;
  splatterScale: number;
  textureOpacity: number;
  translucentAlpha: number;
  hash: number;
  characteristics: ArtworkPaletteCharacteristics;
  material: VinylShaderMaterial;
}): Record<string, string> {
  const {
    type,
    recipe,
    primary,
    secondary,
    accent,
    angle,
    angleAlt,
    splatterScale,
    textureOpacity,
    translucentAlpha,
    hash,
    characteristics,
    material,
  } = input;
  const colorSet = createColorSet(type, primary, secondary, accent);
  const { deep, highlight, edge } = colorSet;
  const soft = shiftLightness(
    desaturate(primary, 0.14),
    type === "translucent" ? 0.2 : 0.14,
  );
  const shadow = shiftLightness(primary, type === "smoke" ? -0.28 : -0.34);
  const groove =
    type === "audiophile-black"
      ? shiftLightness(accent, -0.08)
      : mixColors(primary, type === "translucent" ? highlight : deep, 0.52);
  const grooveBright =
    type === "audiophile-black"
      ? shiftLightness(accent, 0.22)
      : shiftLightness(
          desaturate(primary, 0.08),
          type === "translucent" ? 0.38 : 0.16,
        );
  const labelTint = mixColors(
    primary,
    type === "audiophile-black" ? accent : secondary,
    type === "solid" ? 0.2 : 0.32,
  );
  const pearl = mixColors(
    highlight,
    WHITE,
    type === "translucent" || type === "smoke" ? 0.52 : 0.34,
  );

  const ghostOpacity = ghostOpacityFor(type, characteristics, hash);
  const smokeDensity =
    type === "smoke" ? 0.58 + seededUnit(hash ^ 0x6d2b79f5) * 0.22 : 0.2;
  const organicX = 18 + Math.round(seededUnit(hash ^ 0x51ed270b) * 64);
  const organicY = 18 + Math.round(seededUnit(hash ^ 0x27d4eb2d) * 64);

  return {
    "--pressing-primary": toRgb(primary),
    "--pressing-secondary": toRgb(secondary),
    "--pressing-accent": toRgb(accent),
    "--pressing-deep": toRgb(deep),
    "--pressing-soft": toRgb(soft),
    "--pressing-highlight": toRgb(highlight),
    "--pressing-shadow": toRgb(shadow),
    "--pressing-edge": toRgb(edge),
    "--pressing-pearl": toRgb(pearl),
    "--pressing-groove": toRgb(groove),
    "--pressing-groove-bright": toRgb(grooveBright),
    "--pressing-label-bg": toRgb(labelTint),
    "--pressing-seed-angle": `${angle}deg`,
    "--pressing-seed-angle-alt": `${angleAlt}deg`,
    "--pressing-texture-opacity": textureOpacity.toFixed(3),
    "--pressing-translucency": translucentAlpha.toFixed(3),
    "--pressing-splatter-scale": splatterScale.toFixed(3),
    "--pressing-ghost-opacity": ghostOpacity.toFixed(3),
    "--pressing-smoke-density": smokeDensity.toFixed(3),
    "--pressing-organic-x": `${organicX}%`,
    "--pressing-organic-y": `${organicY}%`,
    "--pressing-hash-a": `${(hash >>> 0) % 997}px`,
    "--pressing-hash-b": `${(hash >>> 7) % 991}px`,
    "--pressing-renderer-recipe": recipe,
    "--pressing-shader-alpha": material.alpha.toFixed(3),
    "--pressing-rim-absorption": material.rimAbsorption.toFixed(3),
    "--pressing-reflection-strength": (0.76 + material.diffraction).toFixed(3),
  };
}

function createPressingName(
  recipe: VinylPressingRecipe,
  primary: RgbColor,
  secondary: RgbColor,
  accent: RgbColor,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): string {
  const colorName = nameColor(primary, c);
  const accentName =
    seededUnit(hash ^ 0x7342a123) > 0.54
      ? nameColor(accent, c)
      : nameColor(secondary, c);

  switch (recipe) {
    case "opaque-solid":
      return `${colorName} Opaque Wax`;
    case "clear-tint":
      return `${colorName} Clear Tint`;
    case "smoke-clear":
      return c.isAchromatic
        ? "Clear Smoke Pressing"
        : `${colorName} Smoke Clear`;
    case "marble-blend":
      return `${colorName}/${accentName} Marble`;
    case "splatter":
      return `${colorName} Splatter`;
    case "color-in-color":
      return `${accentName} in ${colorName} Clear`;
    case "merge":
      return `${colorName}/${accentName} Merge`;
    case "galaxy":
      return `${colorName} Galaxy`;
    case "audiophile-black":
      return "180g Audiophile Black";
  }
}

function nameColor(color: RgbColor, c: ArtworkPaletteCharacteristics): string {
  if (c.isAchromatic || color.s < 0.12) {
    if (color.l > 0.78) return "Bone White";
    if (color.l > 0.58) return "Silver";
    if (color.l > 0.34) return "Graphite";
    return "Black";
  }
  const h = ((color.h % 360) + 360) % 360;
  if (h < 18 || h >= 345) return "Crimson";
  if (h < 42) return "Amber";
  if (h < 66) return "Gold";
  if (h < 150) return "Green";
  if (h < 190) return "Teal";
  if (h < 238) return "Blue";
  if (h < 285) return "Violet";
  if (h < 330) return "Magenta";
  return "Rose";
}

function textureOpacityFor(
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): number {
  const jitter = seededUnit(hash ^ 0x27d4eb2d) * 0.08;
  switch (type) {
    case "solid":
      return 0.24 + jitter;
    case "marble":
      return 0.72 + jitter;
    case "splatter":
      return 0.94 + jitter;
    case "translucent":
      return 0.62 + jitter;
    case "dual-tone":
      return 0.58 + jitter;
    case "smoke":
      return (c.isLight ? 0.64 : 0.72) + jitter;
    case "audiophile-black":
      return c.isDark ? 0.3 + jitter : 0.4 + jitter;
  }
}

function translucencyFor(
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): number {
  const jitter = seededUnit(hash ^ 0x45d9f3b) * 0.1;
  if (type === "translucent")
    return clamp((c.isNearlyWhite ? 0.38 : 0.48) + jitter, 0.34, 0.62);
  if (type === "smoke")
    return clamp((c.isLight ? 0.52 : 0.62) + jitter, 0.46, 0.76);
  return 1;
}

function ghostOpacityFor(
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): number {
  const jitter = seededUnit(hash ^ 0x94d049bb) * 0.06;
  if (type === "translucent")
    return clamp((c.isNearlyWhite ? 0.28 : 0.2) + jitter, 0.18, 0.36);
  if (type === "smoke")
    return clamp((c.isDark ? 0.1 : 0.16) + jitter, 0.08, 0.24);
  return 0;
}

function preparePrimaryColor(
  color: RgbColor,
  average: RgbColor,
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
): RgbColor {
  if (type === "audiophile-black")
    return colorFromHsl({ h: color.h, s: 0.04, l: 0.045 });

  if (c.isAchromatic) {
    const neutralHue = average.l > 0.55 ? 210 : 205;
    if (type === "translucent")
      return colorFromHsl({
        h: neutralHue,
        s: 0.08,
        l: clamp(average.l, 0.52, 0.78),
      });
    if (type === "smoke")
      return colorFromHsl({
        h: neutralHue,
        s: 0.06,
        l: clamp(average.l, 0.22, 0.62),
      });
    if (type === "marble")
      return colorFromHsl({
        h: neutralHue,
        s: 0.05,
        l: clamp(average.l, 0.34, 0.66),
      });
  }

  if (type === "translucent") {
    return colorFromHsl({
      h: color.h,
      s: clamp(color.s * 0.9 + 0.06, 0.16, 0.72),
      l: clamp(color.l + 0.06, 0.34, 0.7),
    });
  }

  if (type === "smoke") {
    return colorFromHsl({
      h: color.h,
      s: clamp(color.s * 0.72 + 0.05, 0.12, 0.58),
      l: clamp(color.l, 0.16, 0.44),
    });
  }

  return colorFromHsl({
    h: color.h,
    s: clamp(color.s * 1.18 + 0.08, 0.26, 0.9),
    l: clamp(color.l, 0.18, 0.54),
  });
}

function prepareSecondaryColor(
  color: RgbColor,
  primary: RgbColor,
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
): RgbColor {
  if (type === "audiophile-black")
    return colorFromHsl({
      h: primary.h,
      s: 0.04,
      l: c.isNearlyBlack ? 0.66 : 0.82,
    });

  if (c.isAchromatic) {
    if (type === "translucent")
      return colorFromHsl({ h: 210, s: 0.05, l: 0.88 });
    if (type === "smoke")
      return colorFromHsl({
        h: 210,
        s: 0.04,
        l: primary.l > 0.48 ? 0.22 : 0.76,
      });
    return colorFromHsl({ h: 210, s: 0.04, l: 0.82 });
  }

  if (color.s < 0.1 && color.l > 0.62) {
    return colorFromHsl({
      h: primary.h,
      s: type === "splatter" ? 0.06 : 0.1,
      l: clamp(color.l, 0.72, 0.92),
    });
  }

  return colorFromHsl({
    h: color.h,
    s: clamp(color.s * 1.08 + 0.05, 0.16, 0.88),
    l: clamp(
      color.l,
      type === "translucent" ? 0.34 : 0.22,
      type === "splatter" ? 0.82 : 0.72,
    ),
  });
}

function prepareAccentColor(
  color: RgbColor,
  primary: RgbColor,
  type: VinylPressingType,
  c: ArtworkPaletteCharacteristics,
  hash: number,
): RgbColor {
  if (type === "audiophile-black") {
    const hue = c.isWarm ? 38 : 205;
    return colorFromHsl({ h: hue, s: 0.18, l: 0.58 });
  }

  if (c.isAchromatic) {
    const coolHue = 198 + Math.round(seededUnit(hash ^ 0x1234abcd) * 28);
    const warmHue = 34 + Math.round(seededUnit(hash ^ 0xabcd1234) * 22);
    const hue = c.isNearlyWhite
      ? coolHue
      : c.isDark
        ? coolHue
        : seededUnit(hash) > 0.55
          ? warmHue
          : coolHue;
    return colorFromHsl({
      h: hue,
      s: type === "smoke" ? 0.16 : 0.22,
      l: type === "translucent" ? 0.72 : 0.56,
    });
  }

  if (color.s < 0.1) {
    return colorFromHsl({
      h: (primary.h + 32) % 360,
      s: 0.32,
      l: clamp(color.l, 0.38, 0.78),
    });
  }

  return colorFromHsl({
    h: color.h,
    s: clamp(color.s * 1.22 + 0.08, 0.34, 0.98),
    l: clamp(color.l, 0.28, 0.78),
  });
}

function normalizeSeed(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed || "vinyldeck:unknown-record";
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 10000) / 10000;
}

function warmth(color: RgbColor): number {
  const h = color.h;
  if (h <= 65 || h >= 330) return color.s;
  if (h >= 260 && h <= 330) return color.s * 0.35;
  return -color.s * 0.35;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = (a.r - b.r) / 255;
  const dg = (a.g - b.g) / 255;
  const db = (a.b - b.b) / 255;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function shiftLightness(color: RgbColor, amount: number): RgbColor {
  return colorFromHsl({
    h: color.h,
    s: color.s,
    l: clamp(color.l + amount, 0.025, 0.94),
  });
}

function desaturate(color: RgbColor, amount: number): RgbColor {
  return colorFromHsl({
    h: color.h,
    s: clamp(color.s - amount, 0, 1),
    l: color.l,
  });
}

export function mixColors(a: RgbColor, b: RgbColor, bWeight: number): RgbColor {
  const weight = clamp(bWeight, 0, 1);
  return colorFromRgb(
    a.r * (1 - weight) + b.r * weight,
    a.g * (1 - weight) + b.g * weight,
    a.b * (1 - weight) + b.b * weight,
  );
}

function colorFromHsl(color: HslColor): RgbColor {
  const [r, g, b] = hslToRgb(color.h, color.s, color.l);
  return colorFromRgb(r, g, b);
}

export function toRgb(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const values = [r, g, b].map((value) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${values.join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = clamp(r, 0, 255) / 255;
  const gf = clamp(g, 0, 255) / 255;
  const bf = clamp(b, 0, 255) / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case rf:
      h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
      break;
    case gf:
      h = ((bf - rf) / d + 2) / 6;
      break;
    case bf:
      h = ((rf - gf) / d + 4) / 6;
      break;
  }

  return [Math.round(h * 360), s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 360;

  if (s === 0) {
    const value = Math.round(l * 255);
    return [value, value, value];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  ];
}

function hueToRgb(p: number, q: number, tInput: number): number {
  let t = tInput;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
