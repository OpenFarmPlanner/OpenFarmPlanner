import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface NavEmojiIconProps {
  emoji: string;
  sx?: SxProps<Theme>;
}

/** Renders a nav emoji close to the mockup's proportions (~19px — only slightly larger than the nav text, not dominant), so it doesn't dwarf the label next to it. */
export function NavEmojiIcon({ emoji, sx }: NavEmojiIconProps) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        fontSize: 19,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 19,
        height: 19,
        ...sx,
      }}
    >
      {emoji}
    </Box>
  );
}
