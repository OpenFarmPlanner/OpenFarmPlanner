export interface CropDisplayFields {
  name?: string | null;
  crop_name?: string | null;
  crop_display_name?: string | null;
  variety?: string | null;
  crop_variety?: string | null;
}

export function getCropDisplayName(crop: CropDisplayFields): string {
  return crop.crop_display_name || crop.name || crop.crop_name || '';
}

export function getCropVariety(crop: CropDisplayFields): string {
  return crop.variety || crop.crop_variety || '';
}

export function formatCropDisplayName(crop: CropDisplayFields): string {
  const displayName = getCropDisplayName(crop);
  const variety = getCropVariety(crop);
  if (displayName && variety) {
    return `${displayName} (${variety})`;
  }
  return displayName || variety;
}
