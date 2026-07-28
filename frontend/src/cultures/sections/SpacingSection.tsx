/**
 * SpacingSection: Planting distances (Abstände, Saattiefe)
 * @remarks Presentational, no internal state
 */
import { Box, Typography, TextField } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { fieldRowSx, smallFieldSx } from './styles.tsx';

interface SpacingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function SpacingSection({ formData, errors, onChange, t }: SpacingSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.sectionPlanting')}</Typography>
      <Box sx={fieldRowSx}>
        <TextField
          sx={smallFieldSx}
          type="number"
          label={t('form.distanceWithinRowCm')}
          placeholder={t('form.distanceWithinRowCmPlaceholder')}
          value={formData.distance_within_row_cm ?? ''}
          onChange={e => onChange('distance_within_row_cm', e.target.value ? parseInt(e.target.value) : undefined)}
          error={Boolean(errors.distance_within_row_cm)}
          helperText={errors.distance_within_row_cm}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
        />
        <TextField
          sx={smallFieldSx}
          type="number"
          label={t('form.rowSpacingCm')}
          placeholder={t('form.rowSpacingCmPlaceholder')}
          value={formData.row_spacing_cm ?? ''}
          onChange={e => onChange('row_spacing_cm', e.target.value ? parseInt(e.target.value) : undefined)}
          error={Boolean(errors.row_spacing_cm)}
          helperText={errors.row_spacing_cm}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
        />
        <TextField
          sx={smallFieldSx}
          type="number"
          label={t('form.sowingDepthCm')}
          placeholder={t('form.sowingDepthCmPlaceholder')}
          value={formData.sowing_depth_cm ?? ''}
          onChange={e => onChange('sowing_depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.sowing_depth_cm)}
          helperText={errors.sowing_depth_cm}
          slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
        />
      </Box>
    </>
  );
}
