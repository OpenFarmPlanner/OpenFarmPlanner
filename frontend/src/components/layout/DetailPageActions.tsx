import { Box, Button, Stack, useMediaQuery, useTheme } from '@mui/material';
import { memo, type MouseEvent, type ReactNode } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { ACTION_LABEL_BREAKPOINT, getStandardActionButtonSx } from '../buttons/segmentedControlStyles';
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
  const theme = useTheme();
  // Decides the tooltip *text* only — never the layout. Whether a label is on
  // screen is settled by the responsive `sx` below (plain CSS), so the header
  // renders at its final size on the first paint instead of reflowing once a
  // media query resolves.
  const labelsCollapsed = useMediaQuery(theme.breakpoints.down(ACTION_LABEL_BREAKPOINT));
  const iconOnly = compact || labelsCollapsed;

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexShrink: 0, minWidth: 'auto',
            flexWrap: 'nowrap',
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
            sx={getStandardActionButtonSx(compact, ACTION_LABEL_BREAKPOINT)}
          >
            <Box
              component="span"
              aria-hidden="true"
              sx={{ display: 'inline-flex', mr: compact ? 0 : { xs: 0, [ACTION_LABEL_BREAKPOINT]: 0.75 } }}
            >
              {action.icon}
            </Box>
            <Box
              component="span"
              data-testid="detail-page-action-label"
              sx={{ display: compact ? 'none' : { xs: 'none', [ACTION_LABEL_BREAKPOINT]: 'inline' } }}
            >
              {action.label}
            </Box>
          </Button>
        );

        // An icon-only button has to explain itself, the same way a disabled
        // button does — so it falls back to its own label as the tooltip.
        const tooltip = action.tooltip ?? (iconOnly ? action.label : undefined);
        if (!tooltip) {
          return button;
        }

        return (
          <AppTooltip key={action.label} title={tooltip}>
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
              minWidth: compact ? 40 : { xs: 40, [ACTION_LABEL_BREAKPOINT]: 48 },
              px: compact ? 0.75 : { xs: 0.75, [ACTION_LABEL_BREAKPOINT]: 1.25 },
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
