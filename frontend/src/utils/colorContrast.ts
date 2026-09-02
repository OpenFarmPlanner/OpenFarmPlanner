const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    return null;
  }
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
      break;
    case gNorm:
      h = ((bNorm - rNorm) / delta + 2) / 6;
      break;
    default:
      h = ((rNorm - gNorm) / delta + 4) / 6;
      break;
  }
  return { h, s, l };
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tNorm = t;
  if (tNorm < 0) tNorm += 1;
  if (tNorm > 1) tNorm -= 1;
  if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
  if (tNorm < 1 / 2) return q;
  if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
  return p;
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgbChannel(p, q, h + 1 / 3) * 255,
    g: hueToRgbChannel(p, q, h) * 255,
    b: hueToRgbChannel(p, q, h - 1 / 3) * 255,
  };
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r)
    + 0.7152 * srgbChannelToLinear(g)
    + 0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG 2.x contrast ratio between two hex colors, or null if either is not a valid `#rrggbb` hex color. */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) {
    return null;
  }
  const luminanceA = relativeLuminance(rgbA);
  const luminanceB = relativeLuminance(rgbB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE_TEXT_HEX = '#ffffff';
const WHITE_TEXT_MIN_CONTRAST_RATIO = 4.5;
const LIGHTNESS_DROP = 0.05;
const PHASE_LIGHTNESS_DELTA = 0.06;
const LIGHTNESS_STEP = 0.05;

/**
 * Lightness floor for the growth-phase color: at full saturation, the
 * hue with the highest luminance (yellow-green, h ~ 0.17) still clears
 * 4.5:1 contrast against white text at this lightness (~4.56:1 at 0.24,
 * ~5.27:1 at 0.22 - see frontend probe in the PR that introduced this).
 * Keeping a floor (rather than always subtracting a fixed amount) stops
 * already-dark base colors from being pushed toward near-black.
 */
const MIN_GROWTH_LIGHTNESS = 0.22;

/**
 * Darkens a crop's base hex color for the Gantt chart's growth-phase bar
 * so it reads as noticeably more saturated/darker than the harvest-phase
 * bar (which keeps the lighter, unmodified tone). The hue/saturation are
 * preserved so the crop stays recognizable; only lightness drops.
 *
 * Lightness is reduced by a fixed step, but never below MIN_GROWTH_LIGHTNESS
 * and never below the base color's own lightness (so an already-dark base
 * color isn't lightened back up). On top of that floor, contrast against
 * the white bar label is checked directly and darkened further if needed,
 * so unusually saturated/light hues still keep WCAG AA contrast (>= 4.5:1)
 * even though the floor alone covers the common case.
 *
 * Non-hex or malformed colors are returned unchanged, matching the fallback
 * behavior already used for the harvest-phase color derivation.
 */
export function darkenForGrowthPhase(baseColor: string): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    return baseColor;
  }

  const hsl = rgbToHsl(rgb);
  let lightness = Math.min(hsl.l, Math.max(hsl.l - LIGHTNESS_DROP, MIN_GROWTH_LIGHTNESS));
  let candidateHex = rgbToHex(hslToRgb({ ...hsl, l: lightness }));

  while (
    lightness > 0
    && (contrastRatio(candidateHex, WHITE_TEXT_HEX) ?? Infinity) < WHITE_TEXT_MIN_CONTRAST_RATIO
  ) {
    lightness = Math.max(0, lightness - LIGHTNESS_STEP);
    candidateHex = rgbToHex(hslToRgb({ ...hsl, l: lightness }));
  }

  return candidateHex;
}

/**
 * Returns paired Gantt colors for a planting plan's growth and harvest phases,
 * with the original crop color centered between them. Both colors are
 * derived in HSL space so the lightness offset stays consistent instead of
 * depending on alpha blending against the timeline background.
 */
export function getGanttPhaseColors(baseColor: string): { growth: string; harvest: string } {
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    return { growth: baseColor, harvest: baseColor };
  }

  const hsl = rgbToHsl(rgb);
  return {
    growth: rgbToHex(hslToRgb({ ...hsl, l: Math.max(0, hsl.l - PHASE_LIGHTNESS_DELTA) })),
    harvest: rgbToHex(hslToRgb({ ...hsl, l: Math.min(1, hsl.l + PHASE_LIGHTNESS_DELTA) })),
  };
}
