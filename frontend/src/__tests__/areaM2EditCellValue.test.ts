import { describe, expect, it } from 'vitest';
import { getInitialInputValue } from '../components/data-grid/areaM2EditCellValue';

describe('getInitialInputValue', () => {
  it('keeps a non-numeric raw string verbatim (e.g. an area expression)', () => {
    expect(getInitialInputValue('3x4', null, 'de-DE')).toBe('3x4');
  });

  it('locale-formats a numeric value without grouping', () => {
    expect(getInitialInputValue(1234.5, null, 'de-DE')).toBe('1234,5');
  });

  it('parses and formats a numeric string', () => {
    expect(getInitialInputValue('12.25', null, 'de-DE')).toBe('12,25');
  });

  it('rounds to at most two fraction digits', () => {
    expect(getInitialInputValue(1.239, null, 'de-DE')).toBe('1,24');
  });

  it('uses the numeric fallback when the value is empty', () => {
    expect(getInitialInputValue('', 7.5, 'de-DE')).toBe('7,5');
    expect(getInitialInputValue(null, 7.5, 'de-DE')).toBe('7,5');
  });

  it('returns an empty string when neither value nor fallback is usable', () => {
    expect(getInitialInputValue('', null, 'de-DE')).toBe('');
    expect(getInitialInputValue(null, null, 'de-DE')).toBe('');
  });
});
