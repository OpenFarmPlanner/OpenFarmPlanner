import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { varietySpecificValueHighlightSx } from '../../../cultures/varietyValueAccent';

export interface DetailRowProps {
  label: string;
  value: string;
  source?: 'fromCrop' | 'ownValue' | null;
}

export function DetailRow({ label, value, source = null }: DetailRowProps) {
  const ownValueSx = source === 'ownValue' ? varietySpecificValueHighlightSx : undefined;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={[{ overflowWrap: 'anywhere' }, ...(ownValueSx ? [ownValueSx] : [])]}>
        {value}
      </Typography>
    </Box>
  );
}

export interface DetailSectionProps {
  title: string;
  children: ReactNode;
  outlined?: boolean;
}

export function DetailSection({ title, children, outlined = false }: DetailSectionProps) {
  return (
    <Box sx={outlined ? { p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2 } : undefined}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      {children}
    </Box>
  );
}
