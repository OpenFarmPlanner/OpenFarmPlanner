import { cropAPI } from '../api/api';
import type { Crop, PublicCrop } from '../api/types';
import { getCropDisplayName, getCropVariety } from './cropDisplay';
import { hasStrongCropSpeciesIdentityMatch } from './cropSpeciesMatching';

/**
 * A project Sorte the publishing wizard offers to publish together with its
 * general Kultur.
 *
 * Sorten that are already connected to the library are not candidates: they
 * either have their own public entry already, or they were imported from one.
 * Re-linking them here would flip `origin_type` to `imported` on a row the
 * user owns (see `link_project_crop_to_public_reference`).
 */
export interface PublishVarietyCandidate {
  crop: Crop;
  cropId: number;
  label: string;
  /** Public entry with the same/similar variety name: link instead of proposing a duplicate. */
  existingPublicCrop: PublicCrop | null;
}

export interface PublishVarietySelection {
  cropId: number;
  /** Set when the Sorte matches an existing public entry and is only linked to it. */
  publicCropId: number | null;
}

export interface PublishVarietiesResult {
  published: number;
  linked: number;
  failed: number;
}

export const getPublishVarietyLabel = (crop: Crop): string => (
  getCropVariety(crop).trim() || getCropDisplayName(crop)
);

const isConnectedToLibrary = (crop: Crop): boolean => (
  Boolean(crop.owned_public_crop_id) || Boolean(crop.source_public_crop)
);

/**
 * The public entry this Sorte would duplicate, if any.
 *
 * Uses the same "same or similar name" rule as the species picker
 * (`hasStrongCropSpeciesIdentityMatch`), so "Roma" and "Romaa" are recognized
 * as the same Sorte while "Roma" and "Roma Rispen" stay distinct entries.
 */
export const findExistingPublicVariety = (
  crop: Crop,
  publicCrops: readonly PublicCrop[],
): PublicCrop | null => {
  const varietyName = getCropVariety(crop).trim();
  if (!varietyName) {
    return null;
  }
  return publicCrops.find((candidate) => {
    const publicVariety = (candidate.variety || '').trim();
    return Boolean(publicVariety)
      && hasStrongCropSpeciesIdentityMatch(varietyName, [{ searchNames: [publicVariety] }]);
  }) ?? null;
};

/** The Sorten of a Kultur group that can still be published from the wizard. */
export const getPublishableVarieties = (varieties: readonly Crop[]): Crop[] => (
  varieties.filter((crop) => (
    typeof crop.id === 'number'
    && Boolean(getCropVariety(crop).trim())
    && !isConnectedToLibrary(crop)
  ))
);

export const buildPublishVarietyCandidates = (
  varieties: readonly Crop[],
  publicCrops: readonly PublicCrop[],
): PublishVarietyCandidate[] => (
  getPublishableVarieties(varieties)
    .map((crop) => ({
      crop,
      cropId: crop.id as number,
      label: getPublishVarietyLabel(crop),
      existingPublicCrop: findExistingPublicVariety(crop, publicCrops),
    }))
);

/**
 * Publish (or link) the Sorten the user kept selected in the publishing wizard.
 *
 * Runs after the general Kultur itself was published, one Sorte at a time: the
 * backend derives the species-level entry from the first publication, and a
 * failing Sorte must not abort the remaining ones.
 */
export const publishSelectedVarieties = async ({
  varieties,
  cropSpeciesId,
  originalLanguageCode,
  acceptedPublicLibraryTerms = false,
}: {
  varieties: readonly PublishVarietySelection[];
  cropSpeciesId?: number;
  originalLanguageCode: string;
  acceptedPublicLibraryTerms?: boolean;
}): Promise<PublishVarietiesResult> => {
  const result: PublishVarietiesResult = { published: 0, linked: 0, failed: 0 };
  for (const variety of varieties) {
    try {
      if (variety.publicCropId) {
        await cropAPI.linkPublicCrop(variety.cropId, variety.publicCropId);
        result.linked += 1;
        continue;
      }
      await cropAPI.publishPublic(variety.cropId, {
        // The backend only records an acceptance while none exists, so
        // repeating the flag from the Kultur publish costs nothing and keeps
        // the Sorten publishable on the paths that do not publish the Kultur
        // itself (linking an existing public entry).
        accepted_public_library_terms: acceptedPublicLibraryTerms,
        crop_species_id: cropSpeciesId,
        original_language_code: originalLanguageCode,
      });
      result.published += 1;
    } catch (error) {
      console.error('Error publishing variety:', error);
      result.failed += 1;
    }
  }
  return result;
};
