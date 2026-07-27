import { describe, expect, it } from 'vitest';
import {
  buildCultureIdentityKey,
  normalizeCultureIdentityValue,
} from '../cultures/cultureIdentity';

describe('normalizeCultureIdentityValue', () => {
  it('lowercases and collapses inner whitespace', () => {
    expect(normalizeCultureIdentityValue('  Roma   Tomate ')).toBe('roma tomate');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeCultureIdentityValue('')).toBeNull();
    expect(normalizeCultureIdentityValue('   ')).toBeNull();
    expect(normalizeCultureIdentityValue(null)).toBeNull();
    expect(normalizeCultureIdentityValue(undefined)).toBeNull();
  });
});

describe('buildCultureIdentityKey', () => {
  it('builds a stable key from name and variety', () => {
    expect(buildCultureIdentityKey('Tomate', 'Roma'))
      .toBe(buildCultureIdentityKey(' tomate ', 'ROMA'));
  });

  it('returns null when either name or variety is missing', () => {
    expect(buildCultureIdentityKey('Tomate', '')).toBeNull();
    expect(buildCultureIdentityKey('', 'Roma')).toBeNull();
    expect(buildCultureIdentityKey(null, null)).toBeNull();
  });

  it('does not collide across differently split name/variety pairs', () => {
    expect(buildCultureIdentityKey('a b', 'c'))
      .not.toBe(buildCultureIdentityKey('a', 'b c'));
  });
});
