import type { MouseEventHandler, ReactNode } from 'react';
import { IconButton } from '@mui/material';

import { AppTooltip } from '../AppTooltip';

interface GanttFilterIconButtonProps {
  /** Used as both the tooltip text and the accessible name. */
  title: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

/**
 * Bordered 40x40 icon button used by the calendar filter bars, sized to match
 * the adjacent small search field and filter button on mobile.
 */
export function GanttFilterIconButton({ title, onClick, children }: GanttFilterIconButtonProps) {
  return (
    <AppTooltip title={title}>
      <IconButton
        size="small"
        aria-label={title}
        onClick={onClick}
        sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
      >
        {children}
      </IconButton>
    </AppTooltip>
  );
}
