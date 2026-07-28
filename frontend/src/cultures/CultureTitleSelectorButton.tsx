import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';

interface CultureTitleSelectorButtonProps {
  title: string;
  ariaLabel: string;
  onClick: () => void;
  titleSx?: SxProps<Theme>;
}

export function CultureTitleSelectorButton({
  title,
  ariaLabel,
  onClick,
  titleSx,
}: CultureTitleSelectorButtonProps) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        p: 0,
        m: 0,
        maxWidth: '100%',
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        color: 'inherit',
        textAlign: 'left',
        borderRadius: 0.75,
        '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.04)' },
        '&:active': { bgcolor: 'rgba(15, 23, 42, 0.08)' },
        '&:focus-visible': { outline: '2px solid rgba(37, 111, 42, 0.28)', outlineOffset: 2 },
      }}
      aria-label={ariaLabel}
    >
      <Typography
        data-testid="culture-title-selector-label"
        component="span"
        noWrap
        sx={[
          {
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '1.25rem',
            lineHeight: 1.2,
            fontWeight: 600,
          },
          ...(Array.isArray(titleSx) ? titleSx : [titleSx]),
        ]}
      >
        {title}
      </Typography>
      <ExpandMoreIcon data-testid="culture-title-selector-chevron" sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
    </Box>
  );
}
