export interface CultureDisplayFields {
  name?: string | null;
  culture_name?: string | null;
  culture_display_name?: string | null;
  variety?: string | null;
  culture_variety?: string | null;
}

export function getCultureDisplayName(culture: CultureDisplayFields): string {
  return culture.culture_display_name || culture.name || culture.culture_name || '';
}

export function getCultureVariety(culture: CultureDisplayFields): string {
  return culture.variety || culture.culture_variety || '';
}

export function formatCultureDisplayName(culture: CultureDisplayFields): string {
  const displayName = getCultureDisplayName(culture);
  const variety = getCultureVariety(culture);
  if (displayName && variety) {
    return `${displayName} (${variety})`;
  }
  return displayName || variety;
}

/**
 * Separator between a culture and its variety in a single-line label
 * ("Salat · Lollo Bionda"). Kept as a middle dot so the variety reads as an
 * addition to the culture rather than as part of its name.
 */
export const CULTURE_VARIETY_SEPARATOR = ' · ';

export function formatCultureVarietyLabel(culture: CultureDisplayFields): string {
  const displayName = getCultureDisplayName(culture);
  const variety = getCultureVariety(culture);
  if (displayName && variety) {
    return `${displayName}${CULTURE_VARIETY_SEPARATOR}${variety}`;
  }
  return displayName || variety;
}
