import type { PublicCulture } from '../api/types';

const normalizeIdentityValue = (value: string | undefined | null): string => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const getPublishedTimestamp = (publishedAt: string | null | undefined): number => (
  publishedAt ? new Date(publishedAt).getTime() : 0
);

const buildCultureIdentity = (culture: PublicCulture): string => (
  [
    normalizeIdentityValue(culture.name),
    normalizeIdentityValue(culture.variety),
  ].join('||')
);

export const dedupePublicCultures = (cultures: PublicCulture[]): PublicCulture[] => {
  const byIdentity = new Map<string, PublicCulture>();

  for (const candidate of cultures) {
    const identity = buildCultureIdentity(candidate);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, candidate);
      continue;
    }

    const candidatePublishedAt = getPublishedTimestamp(candidate.published_at);
    const existingPublishedAt = getPublishedTimestamp(existing.published_at);
    const shouldReplace = candidatePublishedAt > existingPublishedAt
      || (candidatePublishedAt === existingPublishedAt && candidate.id > existing.id);

    if (shouldReplace) {
      byIdentity.set(identity, candidate);
    }
  }

  return Array.from(byIdentity.values());
};
