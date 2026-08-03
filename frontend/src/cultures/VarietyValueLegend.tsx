import { Box, Typography } from '@mui/material';

interface VarietyValueLegendProps {
  label: string;
}

export function VarietyValueLegend({ label }: VarietyValueLegendProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        color: 'text.secondary',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 9,
          height: 9,
          borderRadius: 0.75,
          bgcolor: 'primary.main',
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
