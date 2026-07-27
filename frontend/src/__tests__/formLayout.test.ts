import { describe, expect, it } from 'vitest';
import {
  compactFieldSx,
  formRowSx,
  fullWidthFieldSx,
  mediumFieldSx,
  smallFieldSx,
  wideFieldSx,
} from '../components/forms/formLayout';

describe('form layout widths', () => {
  it.each([
    ['compact', compactFieldSx, 180],
    ['small', smallFieldSx, 224],
    ['medium', mediumFieldSx, 300],
    ['wide', wideFieldSx, 400],
  ])('keeps %s fields fluid on mobile and bounded on larger screens', (_name, sx, desktopWidth) => {
    expect(sx.width).toEqual({ xs: '100%', sm: desktopWidth });
    expect(sx.maxWidth).toEqual({ xs: '100%', sm: desktopWidth });
    expect(sx.flex).toEqual({ xs: '1 1 100%', sm: `0 1 ${desktopWidth}px` });
  });

  it('keeps prose fields full width and allows compact rows to wrap', () => {
    expect(fullWidthFieldSx.width).toBe('100%');
    expect(formRowSx.flexWrap).toBe('wrap');
  });
});
