import type { PublicCrop } from '../api/types';

const normalizeIdentityValue = (value: string | undefined | null): string => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const getPublishedTimestamp = (publishedAt: string | null | undefined): number => (
  publishedAt ? new Date(publishedAt).getTime() : 0
);

const buildCropIdentity = (crop: PublicCrop): string => (
  [
    normalizeIdentityValue(crop.name),
    normalizeIdentityValue(crop.variety),
  ].join('||')
);

export const dedupePublicCrops = (crops: PublicCrop[]): PublicCrop[] => {
  const byIdentity = new Map<string, PublicCrop>();

  for (const candidate of crops) {
    const identity = buildCropIdentity(candidate);
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
