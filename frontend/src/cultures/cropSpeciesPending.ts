import type { PublicCulture } from '../api/types';

/**
 * Whether a public library entry hangs off a crop species no moderator has
 * reviewed yet.
 *
 * The entry itself is published and visible — only the species behind it is
 * provisional, which is why importing, updating and discussing it are blocked
 * (the backend enforces the same rule with `crop_species_pending`).
 */
export const isCropSpeciesPending = (culture: Pick<PublicCulture, 'crop_species_status'> | null | undefined): boolean => (
  culture?.crop_species_status === 'proposed'
);
