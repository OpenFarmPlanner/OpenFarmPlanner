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
          width: 4,
          height: 18,
          borderRadius: 999,
          bgcolor: 'primary.main',
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
