import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { shouldShowAreaTooltip } from './compactAreaCellUtils';

interface CompactAreaCellProps {
  label: string;
  hasFocus?: boolean;
}

export function CompactAreaCell({ label, hasFocus = false }: CompactAreaCellProps) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }

    const updateOverflow = (): void => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    updateOverflow();
    window.addEventListener('resize', updateOverflow);
    return () => {
      window.removeEventListener('resize', updateOverflow);
    };
  }, [label]);

  const showTooltip = useMemo(
    () => shouldShowAreaTooltip(label, isOverflowing),
    [isOverflowing, label],
  );

  useEffect(() => {
    if (!hasFocus || !showTooltip) {
      return;
    }

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [hasFocus, showTooltip]);

  return (
    <Tooltip
      title={showTooltip ? label : ''}
      disableHoverListener={!showTooltip}
      disableFocusListener={!showTooltip}
      disableTouchListener={!showTooltip}
      enterTouchDelay={450}
    >
      <Box
        ref={triggerRef}
        sx={{ width: '100%', minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', height: '100%' }}
        tabIndex={hasFocus && showTooltip ? 0 : -1}
        aria-label={showTooltip ? label : undefined}
      >
        <Typography
          ref={textRef}
          variant="body2"
          noWrap
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
