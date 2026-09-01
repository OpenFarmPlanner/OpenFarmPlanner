import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRouteLoadRetry,
  resetDynamicImportRecovery,
  shouldAutomaticallyReloadForChunkError,
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

  it('allows retrying a route again once the retry window has passed', () => {
    const now = 1_000_000;

    expect(shouldAutomaticallyReloadForRouteLoadError('/app/crop-library', now)).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/crop-library', now + 59_000)).toBe(false);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/crop-library', now + 61_000)).toBe(true);
  });

  it('clears both guards so a manual retry is never swallowed', () => {
    const now = 1_000_000;

    expect(shouldAutomaticallyReloadForChunkError(now)).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/crop-library', now)).toBe(true);

    resetDynamicImportRecovery('/app/crop-library');

    expect(shouldAutomaticallyReloadForChunkError(now)).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/crop-library', now)).toBe(true);
  });
});
