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
