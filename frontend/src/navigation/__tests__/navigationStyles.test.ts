import { describe, expect, it } from 'vitest';
import type { SxProps, Theme } from '@mui/material/styles';
import theme from '../../theme';
import {
  NAV_ITEM_DISABLED_OPACITY,
  getMobileNavigationIconSx,
  getMobileNavigationItemSx,
  getMobileNavigationTextProps,
  getNavigationIconSx,
  getNavigationItemSx,
  getNavigationTextProps,
} from '../navigationStyles';

function resolveSx(sx: SxProps<Theme>): Record<string, unknown> {
  return typeof sx === 'function' ? (sx as (t: Theme) => Record<string, unknown>)(theme) : (sx as Record<string, unknown>);
}

describe('desktop sidebar disabled styling', () => {
  it('reduces icon and text opacity when disabled, and keeps full opacity otherwise', () => {
    expect(resolveSx(getNavigationIconSx(false, false, true)).opacity).toBe(NAV_ITEM_DISABLED_OPACITY);
    expect(resolveSx(getNavigationIconSx(false, false, false)).opacity).toBe(1);

    const disabledText = getNavigationTextProps(false, true).sx(theme);
    const enabledText = getNavigationTextProps(false, false).sx(theme);
    expect(disabledText.opacity).toBe(NAV_ITEM_DISABLED_OPACITY);
    expect(enabledText.opacity).toBe(1);
  });

  it('drops the hover style block when disabled', () => {
    const disabledItem = resolveSx(getNavigationItemSx(false, false, true));
    const enabledItem = resolveSx(getNavigationItemSx(false, false, false));
    expect(disabledItem['&:hover']).toBeUndefined();
    expect(enabledItem['&:hover']).toBeDefined();
    expect(disabledItem.cursor).toBe('not-allowed');
  });
});

describe('mobile drawer disabled styling', () => {
  it('reduces icon and text opacity when disabled, and keeps full opacity otherwise', () => {
    expect(resolveSx(getMobileNavigationIconSx(false, true)).opacity).toBe(NAV_ITEM_DISABLED_OPACITY);
    expect(resolveSx(getMobileNavigationIconSx(false, false)).opacity).toBe(1);

    const disabledText = getMobileNavigationTextProps(false, true).sx(theme);
    const enabledText = getMobileNavigationTextProps(false, false).sx(theme);
    expect(disabledText.opacity).toBe(NAV_ITEM_DISABLED_OPACITY);
    expect(enabledText.opacity).toBe(1);
  });

  it('drops the hover style block when disabled', () => {
    const disabledItem = resolveSx(getMobileNavigationItemSx(false, true));
    const enabledItem = resolveSx(getMobileNavigationItemSx(false, false));
    expect(disabledItem['&:hover']).toBeUndefined();
    expect(enabledItem['&:hover']).toBeDefined();
  });
});
