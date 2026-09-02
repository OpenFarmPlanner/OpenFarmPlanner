import { describe, expect, it } from 'vitest';
import { contrastRatio, darkenForGrowthPhase, getGanttPhaseColors } from '../utils/colorContrast';

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5);
  });

  it('returns null for non-hex input', () => {
    expect(contrastRatio('rgba(0,0,0,0.5)', '#ffffff')).toBeNull();
  });
});

describe('darkenForGrowthPhase', () => {
  it('returns non-hex colors unchanged', () => {
    expect(darkenForGrowthPhase('rgba(59, 130, 246, 0.8)')).toBe('rgba(59, 130, 246, 0.8)');
  });

  it('darkens a mid-tone crop color while preserving its hue family', () => {
    const base = '#3b82f6'; // blue
    const darkened = darkenForGrowthPhase(base);
    expect(darkened).not.toBe(base);
    expect(darkened.toLowerCase()).not.toBe(base.toLowerCase());
  });

  it('produces a color with WCAG AA contrast (>= 4.5:1) against white text', () => {
    const lightCropColors = ['#93c5fd', '#fdba74', '#a5f3fc', '#fca5a5', '#fde68a'];
    lightCropColors.forEach((color) => {
      const darkened = darkenForGrowthPhase(color);
      const ratio = contrastRatio(darkened, '#ffffff');
      expect(ratio).not.toBeNull();
      expect(ratio as number).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('still darkens a color that already meets contrast, keeping the phases visually distinct', () => {
    const base = '#1d4ed8'; // already dark/saturated blue
    const darkened = darkenForGrowthPhase(base);
    expect(darkened.toLowerCase()).not.toBe(base.toLowerCase());
  });

  it('does not crush already-dark base colors toward near-black', () => {
    // A dark green/tomato-like color: darkening further used to push this
    // close to #000000, making the white label hard to read.
    const darkGreen = '#166534';
    const darkened = darkenForGrowthPhase(darkGreen);
    const [, , lightness] = (() => {
      const r = parseInt(darkened.slice(1, 3), 16);
      const g = parseInt(darkened.slice(3, 5), 16);
      const b = parseInt(darkened.slice(5, 7), 16);
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      return [null, null, (max + min) / 2];
    })();
    expect(lightness).toBeGreaterThanOrEqual(0.2);
  });

  it('never lightens a base color that is already darker than the floor', () => {
    const nearBlack = '#0a1f12';
    const darkened = darkenForGrowthPhase(nearBlack);
    const ratioToWhite = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
    };
    expect(ratioToWhite(darkened)).toBeLessThanOrEqual(ratioToWhite(nearBlack) + 0.001);
  });

  it('keeps WCAG AA contrast across a hue sweep at full saturation, the worst case for luminance', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const rgb = (() => {
        const h = hue / 360;
        const s = 1;
        const l = 0.5;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (pp: number, qq: number, t: number) => {
          let tt = t;
          if (tt < 0) tt += 1;
          if (tt > 1) tt -= 1;
          if (tt < 1 / 6) return pp + (qq - pp) * 6 * tt;
          if (tt < 1 / 2) return qq;
          if (tt < 2 / 3) return pp + (qq - pp) * (2 / 3 - tt) * 6;
          return pp;
        };
        return [
          hue2rgb(p, q, h + 1 / 3),
          hue2rgb(p, q, h),
          hue2rgb(p, q, h - 1 / 3),
        ].map((c) => Math.round(c * 255));
      })();
      const toHex = (c: number) => c.toString(16).padStart(2, '0');
      const hex = `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;

      const darkened = darkenForGrowthPhase(hex);
      const ratio = contrastRatio(darkened, '#ffffff');
      expect(ratio).not.toBeNull();
      expect(ratio as number).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('getGanttPhaseColors', () => {
  const getLightness = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  };

  it('returns non-hex colors unchanged for both phases', () => {
    const color = 'rgba(59, 130, 246, 0.8)';
    expect(getGanttPhaseColors(color)).toEqual({ growth: color, harvest: color });
  });

  it('keeps the base color centered between growth and harvest lightness', () => {
    ['#1d4ed8', '#166534', '#c2410c', '#be123c', '#6d28d9'].forEach((baseColor) => {
      const { growth, harvest } = getGanttPhaseColors(baseColor);
      const baseLightness = getLightness(baseColor);
      expect(growth).not.toBe(harvest);
      expect(baseLightness - getLightness(growth)).toBeCloseTo(0.05, 1);
      expect(getLightness(harvest) - baseLightness).toBeCloseTo(0.05, 1);
    });
  });

});
