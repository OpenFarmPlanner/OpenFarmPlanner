import type { ReactElement, ReactNode } from 'react';
import { Box, Button, Popover } from '@mui/material';

interface FilterPopoverShellProps {
  id: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onReset: () => void;
  resetLabel: string;
  children: ReactNode;
}

/**
 * Popover chrome (anchor/positioning, sizing, two-column field grid, reset
 * button) shared by every "filter icon next to a search field" control in
 * the app, so they all look and behave the same regardless of which fields
 * a given context filters by.
 */
export function FilterPopoverShell({
  id,
  anchorEl,
  onClose,
  onReset,
  resetLabel,
  children,
}: FilterPopoverShellProps): ReactElement {
  return (
    <Popover
      id={id}
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: { sx: { width: { xs: 'min(92vw, 360px)', sm: 360 }, p: 1.5 } }
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
          pt: 0.5,
          pb: 0.5,
        }}
      >
        {children}
        <Button
          variant="text"
          size="small"
          onClick={onReset}
          sx={{ justifySelf: 'end', whiteSpace: 'nowrap', gridColumn: '1 / -1' }}
        >
          {resetLabel}
        </Button>
      </Box>
    </Popover>
  );
}
