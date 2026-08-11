import { Box, Button, Stack } from '@mui/material';
import { memo, type MouseEvent, type ReactNode } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { getStandardActionButtonSx } from '../buttons/segmentedControlStyles';
import { AppTooltip } from '../AppTooltip';

export interface DetailPagePrimaryAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'contained' | 'outlined';
}

interface DetailPageActionsProps {
  primaryActions: DetailPagePrimaryAction[];
  overflowLabel?: string;
  onOpenOverflow?: (event: MouseEvent<HTMLElement>) => void;
  compact?: boolean;
}

export const DetailPageActions = memo(function DetailPageActions({
  primaryActions,
  overflowLabel,
  onOpenOverflow,
  compact = false,
}: DetailPageActionsProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexShrink: 0, minWidth: 'auto',
            flexWrap: compact ? 'nowrap' : { xs: 'nowrap', sm: 'wrap' },
            justifyContent: compact ? 'flex-start' : { xs: 'flex-start', sm: 'flex-end' }, }}
    >
      {primaryActions.map((action) => {
        const button = (
          <Button
            key={action.label}
            variant={action.variant ?? 'outlined'}
            size="medium"
            aria-label={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            sx={getStandardActionButtonSx(compact)}
          >
            <Box component="span" aria-hidden="true" sx={{ display: 'inline-flex', mr: compact ? 0 : { xs: 0, sm: 0.75 } }}>
              {action.icon}
            </Box>
            <Box component="span" sx={{ display: compact ? 'none' : { xs: 'none', sm: 'inline' } }}>
              {action.label}
            </Box>
          </Button>
        );

        if (!action.tooltip) {
          return button;
        }

        return (
          <AppTooltip key={action.label} title={action.tooltip}>
            <span>{button}</span>
          </AppTooltip>
        );
      })}
      {overflowLabel && onOpenOverflow ? (
        <AppTooltip title={overflowLabel}>
          <Button
            aria-label={overflowLabel}
            onClick={onOpenOverflow}
            variant="outlined"
            size="medium"
            sx={{
              alignSelf: 'center',
              minHeight: 40,
              minWidth: compact ? 40 : { xs: 40, sm: 48 },
              px: compact ? 0.75 : { xs: 0.75, sm: 1.25 },
              width: 'auto',
            }}
          >
            <MoreVertIcon fontSize="small" />
          </Button>
        </AppTooltip>
      ) : null}
    </Stack>
  );
});
