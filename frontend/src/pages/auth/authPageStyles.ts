export const authPrimaryButtonSx = {
  minHeight: 46,
  borderRadius: 2,
  px: { xs: 2, sm: 3.2 },
  whiteSpace: 'nowrap',
  boxShadow: 3,
  transition: 'transform 160ms ease, box-shadow 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: 5,
  },
  '&:focus-visible': {
    outline: '3px solid rgba(46, 125, 50, 0.35)',
    outlineOffset: 2,
  },
};

export const authSecondaryButtonSx = {
  minHeight: 46,
  borderRadius: 2,
  px: { xs: 2, sm: 3.2 },
  color: 'primary.main',
  borderColor: '#fff',
  bgcolor: '#fff',
  whiteSpace: 'nowrap',
  boxShadow: 2,
  transition: 'transform 160ms ease, color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    color: 'primary.dark',
    borderColor: '#fff',
    bgcolor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: 4,
  },
  '&:focus-visible': {
    outline: '3px solid rgba(46, 125, 50, 0.35)',
    outlineOffset: 2,
  },
};

export const authTextButtonSx = {
  minHeight: 40,
  borderRadius: 2,
  fontWeight: 600,
  color: 'primary.dark',
  textAlign: 'center',
  whiteSpace: 'normal',
  '&:hover': {
    bgcolor: 'rgba(46, 125, 50, 0.08)',
  },
  '&:focus-visible': {
    outline: '3px solid rgba(46, 125, 50, 0.28)',
    outlineOffset: 2,
  },
};

export const authTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
  },
  '& .MuiInputAdornment-root': {
    mr: -0.5,
  },
};

export const authFormSx = {
  width: '100%',
};

export const authLegalLinkSx = {
  color: 'text.primary',
  transition: 'color 160ms ease',
  '&:visited': {
    color: 'text.primary',
  },
  '&:hover': {
    color: 'primary.dark',
  },
  '&:focus-visible': {
    color: 'primary.dark',
    outline: '2px solid rgba(46, 125, 50, 0.32)',
    outlineOffset: 3,
    borderRadius: 0.5,
  },
};
