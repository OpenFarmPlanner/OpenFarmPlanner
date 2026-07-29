import { describe, expect, it } from 'vitest';

import { formatCultureDisplayName, getCultureDisplayName } from '../cultures/cultureDisplay';

describe('culture display names', () => {
  it('prefers the localized culture display name', () => {
    expect(getCultureDisplayName({
      name: 'Ackerbohne',
      culture_display_name: 'Broad bean',
    })).toBe('Broad bean');
  });

  it('falls back to the stored project culture name when no localized display name exists', () => {
    expect(getCultureDisplayName({
      name: 'Ackerbohne',
      culture_display_name: null,
    })).toBe('Ackerbohne');
  });

  it('keeps variety language-independent when formatting display labels', () => {
    expect(formatCultureDisplayName({
      name: 'Ackerbohne',
      culture_display_name: 'Broad bean',
      variety: 'Hangdown',
    })).toBe('Broad bean (Hangdown)');
  });
});
