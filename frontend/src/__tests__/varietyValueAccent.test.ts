import { afterEach, describe, expect, it } from 'vitest';
import {
  getVarietyValueCueVariant,
  VARIETY_VALUE_CUE_STORAGE_KEY,
} from '../cultures/varietyValueAccent';

function setLocationSearch(search: string) {
  window.history.replaceState(null, '', search ? `/app/cultures?${search}` : '/app/cultures');
}

describe('variety value accent variants', () => {
  afterEach(() => {
    window.localStorage.removeItem(VARIETY_VALUE_CUE_STORAGE_KEY);
    setLocationSearch('');
  });

  it('uses the subtle background variant by default', () => {
    expect(getVarietyValueCueVariant()).toBe('background');
  });

  it('accepts a temporary URL variant for visual comparison', () => {
    setLocationSearch('varietyValueCue=outline');

    expect(getVarietyValueCueVariant()).toBe('outline');
  });

  it('falls back to the stored variant when no URL variant is set', () => {
    window.localStorage.setItem(VARIETY_VALUE_CUE_STORAGE_KEY, 'combined');

    expect(getVarietyValueCueVariant()).toBe('combined');
  });

  it('ignores unknown variant names', () => {
    setLocationSearch('varietyValueCue=warning');
    window.localStorage.setItem(VARIETY_VALUE_CUE_STORAGE_KEY, 'status');

    expect(getVarietyValueCueVariant()).toBe('background');
  });
});
