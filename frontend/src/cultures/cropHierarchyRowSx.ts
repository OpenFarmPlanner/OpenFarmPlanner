export const cropChevronButtonSx = {
  width: 30,
  height: 30,
  minWidth: 30,
  p: 0,
  mr: 0.5,
  color: 'text.primary',
  opacity: 0.72,
  flexShrink: 0,
  '&:hover': {
    opacity: 1,
    bgcolor: 'rgba(37, 111, 42, 0.08)',
  },
} as const;

export const desktopCropChevronButtonSx = {
  ...cropChevronButtonSx,
  mt: -0.375,
} as const;
