import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Crop } from '../api/types';

export interface VarietyFieldSxTooltip {
  sx?: SxProps<Theme>;
  tooltipTitle: ReactNode;
}

/**
 * Returns highlight styling + tooltip content for a field participating in the
 * crop/variety inheritance concept, or `null` when it doesn't apply (e.g. the
 * form isn't editing a variety, or no matching species crop was found).
 */
export type GetVarietyFieldTooltipProps = (
  fields: keyof Crop | (keyof Crop)[],
  helpText?: ReactNode,
) => VarietyFieldSxTooltip | null;

/**
 * Builds the hover tooltip content for a form field that participates in the
 * crop/variety inheritance concept. When the field also has its own help text,
 * both are shown stacked so no existing help tooltip is lost.
 */
export function buildVarietyFieldTooltipTitle(
  t: TFunction,
  active: boolean,
  helpText?: ReactNode,
): ReactNode {
  const varietyText = active
    ? t('hierarchy.ownValueFieldTooltip')
    : t('hierarchy.inheritedFieldTooltip');

  if (!helpText) {
    return varietyText;
  }

  return (
    <>
      <span style={{ display: 'block' }}>{helpText}</span>
      <span style={{ display: 'block', marginTop: 4 }}>{varietyText}</span>
    </>
  );
}
