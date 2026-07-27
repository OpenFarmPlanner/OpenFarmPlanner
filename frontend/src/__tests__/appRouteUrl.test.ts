import { describe, expect, it } from 'vitest';
import { appRouteUrl } from '../utils/appRouteUrl';

describe('appRouteUrl', () => {
  it('keeps app routes at root for root deployments', () => {
    expect(appRouteUrl('/app/dashboard', '/')).toBe('/app/dashboard');
  });

  it('prefixes app routes for subpath deployments', () => {
    expect(appRouteUrl('/app/dashboard', '/openfarmplanner/')).toBe('/openfarmplanner/app/dashboard');
  });

  it('normalizes missing slashes in the base path and route path', () => {
    expect(appRouteUrl('app/dashboard', '/openfarmplanner')).toBe('/openfarmplanner/app/dashboard');
  });
});
