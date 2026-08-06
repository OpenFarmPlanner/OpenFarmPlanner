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

// Used by CropHierarchyRow (the shared compact row) — dimmer at rest so the
// variety-count badge reads as the primary signal, only picking up full
// contrast on hover/focus.
export const compactCropChevronButtonSx = {
  ...cropChevronButtonSx,
  width: 24,
  height: 24,
  minWidth: 24,
  opacity: 0.4,
  '&:hover': {
    opacity: 1,
    bgcolor: 'rgba(37, 111, 42, 0.08)',
  },
} as const;
