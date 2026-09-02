import { describe, expect, it } from 'vitest';
import {
  buildCropIdentityKey,
  normalizeCropIdentityValue,
} from '../crops/cropIdentity';

describe('normalizeCropIdentityValue', () => {
  it('lowercases and collapses inner whitespace', () => {
    expect(normalizeCropIdentityValue('  Roma   Tomate ')).toBe('roma tomate');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeCropIdentityValue('')).toBeNull();
    expect(normalizeCropIdentityValue('   ')).toBeNull();
    expect(normalizeCropIdentityValue(null)).toBeNull();
    expect(normalizeCropIdentityValue(undefined)).toBeNull();
  });
});

describe('buildCropIdentityKey', () => {
  it('builds a stable key from name and variety', () => {
    expect(buildCropIdentityKey('Tomate', 'Roma'))
      .toBe(buildCropIdentityKey(' tomate ', 'ROMA'));
  });

  it('returns null when either name or variety is missing', () => {
    expect(buildCropIdentityKey('Tomate', '')).toBeNull();
    expect(buildCropIdentityKey('', 'Roma')).toBeNull();
    expect(buildCropIdentityKey(null, null)).toBeNull();
  });

  it('does not collide across differently split name/variety pairs', () => {
    expect(buildCropIdentityKey('a b', 'c'))
      .not.toBe(buildCropIdentityKey('a', 'b c'));
  });
});
