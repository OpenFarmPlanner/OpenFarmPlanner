import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { ReactNode } from 'react';
import { AppTooltip } from './AppTooltip';

interface AppIconChipProps extends Pick<
  ChipProps,
  'color' | 'icon' | 'label' | 'disabled' | 'clickable' | 'onClick' | 'sx'
> {
  tooltip: ReactNode;
  'data-testid'?: string;
}

/**
 * Small outlined status chip with a tooltip — the shared shape behind the
 * crop-library sync marker and the pending-species indicator, so a future
 * visual tweak (spacing, disabled styling) happens in one place instead of
 * being hand-rolled per call site.
 */
export function AppIconChip({ tooltip, ...chipProps }: AppIconChipProps) {
  return (
    <AppTooltip title={tooltip}>
      <Chip size="small" variant="outlined" {...chipProps} />
    </AppTooltip>
  );
}
