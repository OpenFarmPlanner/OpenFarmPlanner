import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

export const VARIETY_VALUE_CUE_STORAGE_KEY = 'openfarmplanner.varietyValueCue';

export const VARIETY_VALUE_CUE_VARIANTS = ['background', 'outline', 'combined'] as const;

export type VarietyValueCueVariant = (typeof VARIETY_VALUE_CUE_VARIANTS)[number];

function isVarietyValueCueVariant(value: string | null): value is VarietyValueCueVariant {
  return VARIETY_VALUE_CUE_VARIANTS.some((variant) => variant === value);
}

export function getVarietyValueCueVariant(): VarietyValueCueVariant {
  if (typeof window === 'undefined') {
    return 'background';
  }

  const queryVariant = new URLSearchParams(window.location.search).get('varietyValueCue');
  if (isVarietyValueCueVariant(queryVariant)) {
    return queryVariant;
  }

  const storedVariant = window.localStorage.getItem(VARIETY_VALUE_CUE_STORAGE_KEY);
  return isVarietyValueCueVariant(storedVariant) ? storedVariant : 'background';
}

export function getVarietySpecificFieldSx(): SxProps<Theme> {
  const variant = getVarietyValueCueVariant();
  const lightPrimaryBackground = (theme: Theme) => alpha(theme.palette.primary.main, 0.04);
  const subtlePrimaryOutline = (theme: Theme) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.62)}`;

  return {
    borderRadius: 1,
    ...(variant === 'background' || variant === 'combined'
      ? { backgroundColor: lightPrimaryBackground }
      : {}),
    ...(variant === 'outline' || variant === 'combined'
      ? { boxShadow: subtlePrimaryOutline }
      : {}),
  };
}

export function getVarietyValueLegendMarkerSx(): SxProps<Theme> {
  const variant = getVarietyValueCueVariant();

  return {
    width: 16,
    height: 12,
    borderRadius: 0.75,
    backgroundColor: variant === 'outline'
      ? 'transparent'
      : (theme: Theme) => alpha(theme.palette.primary.main, 0.04),
    boxShadow: variant === 'background'
      ? undefined
      : (theme: Theme) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.62)}`,
  };
}
