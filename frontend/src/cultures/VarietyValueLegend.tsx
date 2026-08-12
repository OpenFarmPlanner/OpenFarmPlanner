import { Box, Typography } from '@mui/material';
import { varietySpecificValueHighlightSx } from './varietyValueAccent';

interface VarietyValueLegendProps {
  sampleLabel: string;
  description: string;
}

export function VarietyValueLegend({ sampleLabel, description }: VarietyValueLegendProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2" color="text.secondary" component="span" sx={varietySpecificValueHighlightSx}>
        {sampleLabel}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        = {description}
      </Typography>
    </Box>
  );
}
