import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { OverflowTooltip } from '../OverflowTooltip';

interface CompactAreaCellProps {
  label: string;
  hasFocus?: boolean;
}

export function CompactAreaCell({ label, hasFocus = false }: CompactAreaCellProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasFocus) {
      return;
    }

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [hasFocus]);

  return (
    <OverflowTooltip title={label}>
      <Box
        ref={triggerRef}
        sx={{ width: '100%', minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', height: '100%' }}
        tabIndex={hasFocus ? 0 : -1}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      </Box>
    </OverflowTooltip>
  );
}
