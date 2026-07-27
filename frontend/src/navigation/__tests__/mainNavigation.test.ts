import { describe, expect, it } from 'vitest';
import { MAIN_NAV_ITEMS, shouldDisableNavItem } from '../mainNavigation';

describe('shouldDisableNavItem', () => {
  it('disables project-dependent items when there is no active project', () => {
    expect(shouldDisableNavItem({ requiresProject: true }, false)).toBe(true);
  });

  it('keeps project-dependent items enabled once a project is active', () => {
    expect(shouldDisableNavItem({ requiresProject: true }, true)).toBe(false);
  });

  it('never disables items that do not require a project', () => {
    expect(shouldDisableNavItem({ requiresProject: false }, false)).toBe(false);
    expect(shouldDisableNavItem({ requiresProject: false }, true)).toBe(false);
  });
});

describe('MAIN_NAV_ITEMS', () => {
  it('marks every current main navigation destination as project-dependent', () => {
    // All of fields-beds/cultures/planting-plans/gantt-chart/yield-overview/
    // seed-demand/suppliers only render real content with an active project
    // (each page falls back to ProjectRequiredState otherwise). If a future
    // route works without a project, flip its `requiresProject` explicitly
    // rather than changing this assertion.
    for (const item of MAIN_NAV_ITEMS) {
      expect(item.requiresProject).toBe(true);
    }
  });
});
