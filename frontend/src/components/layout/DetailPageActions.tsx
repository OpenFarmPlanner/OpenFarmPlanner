import { Button, IconButton, Stack, Tooltip } from '@mui/material';
import type { MouseEvent, ReactNode } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';

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
}

export function DetailPageActions({
  primaryActions,
  overflowLabel,
  onOpenOverflow,
}: DetailPageActionsProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
      sx={{ flexShrink: 0, minWidth: { xs: '100%', sm: 'auto' } }}
    >
      {primaryActions.map((action) => {
        const button = (
          <Button
            key={action.label}
            variant={action.variant ?? 'outlined'}
            size="medium"
            startIcon={action.icon}
            disabled={action.disabled}
            onClick={action.onClick}
            sx={{
              minHeight: 40,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {action.label}
          </Button>
        );

        if (!action.tooltip) {
          return button;
        }

        return (
          <Tooltip key={action.label} title={action.tooltip}>
            <span>{button}</span>
          </Tooltip>
        );
      })}
      {overflowLabel && onOpenOverflow ? (
        <Tooltip title={overflowLabel}>
          <IconButton
            aria-label={overflowLabel}
            onClick={onOpenOverflow}
            sx={{
              alignSelf: { xs: 'flex-start', sm: 'center' },
              border: '1px solid',
              borderColor: 'divider',
              height: 40,
              width: 40,
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}
