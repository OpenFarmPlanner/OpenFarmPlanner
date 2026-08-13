import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRouteLoadRetry,
  shouldAutomaticallyReloadForRouteLoadError,
} from '../runtime/chunkLoadErrors';

describe('route load error recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows one automatic reload per route', () => {
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(false);
  });

  it('tracks retries independently for each route', () => {
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/fields-beds')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(false);
  });

  it('allows retrying a route again after a successful load clears the marker', () => {
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/fields-beds')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/fields-beds')).toBe(false);

    clearRouteLoadRetry('/app/fields-beds');

    expect(shouldAutomaticallyReloadForRouteLoadError('/app/fields-beds')).toBe(true);
  });
});
