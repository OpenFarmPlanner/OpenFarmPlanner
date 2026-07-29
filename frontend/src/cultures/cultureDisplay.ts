import type { Culture } from '../api/types';

export type CultureDisplayFields = Pick<Culture, 'name' | 'culture_display_name'>;

export function getCultureDisplayName(culture: CultureDisplayFields): string {
  return culture.culture_display_name || culture.name;
}

export function formatCultureDisplayName(culture: CultureDisplayFields & Pick<Culture, 'variety'>): string {
  const displayName = getCultureDisplayName(culture);
  return culture.variety ? `${displayName} (${culture.variety})` : displayName;
}
