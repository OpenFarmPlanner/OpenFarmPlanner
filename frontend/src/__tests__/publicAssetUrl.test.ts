import { describe, expect, it } from 'vitest';
import { publicAssetUrl } from '../utils/publicAssetUrl';

describe('publicAssetUrl', () => {
  it('keeps root-based builds unchanged', () => {
    expect(publicAssetUrl('/landing/hero-field.webp', '/')).toBe('/landing/hero-field.webp');
  });

  it('prefixes assets with a configured deployment base path', () => {
    expect(publicAssetUrl('/landing/screenshots/demo-areas.webp', '/openfarmplanner/')).toBe(
      '/openfarmplanner/landing/screenshots/demo-areas.webp',
    );
  });

  it('normalizes missing slashes in the base path and asset path', () => {
    expect(publicAssetUrl('favicon.png', '/openfarmplanner')).toBe('/openfarmplanner/favicon.png');
  });
});
