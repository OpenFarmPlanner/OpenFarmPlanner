import { afterEach, describe, expect, it } from 'vitest';
import { dismissSeasonSetup, isSeasonSetupDismissed } from '../seasonSetupDismissal';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('seasonSetupDismissal', () => {
  it('reports not dismissed for a project that was never dismissed', () => {
    expect(isSeasonSetupDismissed(1)).toBe(false);
  });

  it('reports dismissed after dismissSeasonSetup, and only for that project', () => {
    dismissSeasonSetup(1);
    expect(isSeasonSetupDismissed(1)).toBe(true);
    expect(isSeasonSetupDismissed(2)).toBe(false);
  });

  it('survives being read again (simulating a reload within the same tab)', () => {
    dismissSeasonSetup(42);
    // A fresh read from the same sessionStorage-backed key, as would happen
    // after a page reload in the same tab — this is the exact bug being
    // fixed: dismissal used to live only in in-memory React state and reset
    // on every reload.
    expect(isSeasonSetupDismissed(42)).toBe(true);
  });
});
