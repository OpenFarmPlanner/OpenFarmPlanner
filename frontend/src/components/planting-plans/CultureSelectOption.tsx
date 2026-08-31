import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SearchableSelectOption } from '../inputs/SearchableSelect';

export interface CultureOptionParts {
  /** Culture name, always shown as the leading part of the option. */
  cultureName: string;
  /** Variety name, shown as subordinate information. Empty for plain cultures. */
  variety: string;
}

/**
 * One row of the planting-plan culture dropdown: the Kultur stays the visual
 * anchor, a Sorte is appended as subdued, slightly indented secondary text so
 * several Sorten of the same Kultur still read as belonging to it.
 */
export function CultureSelectOption({ cultureName, variety }: CultureOptionParts) {
  return (
    <Box
      component="span"
      sx={{ display: 'flex', alignItems: 'baseline', minWidth: 0, width: '100%' }}
    >
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}
      >
        {cultureName}
      </Typography>
      {variety ? (
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{
            pl: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {`· ${variety}`}
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * Renders a culture select option, falling back to the plain label for
 * options that carry no culture/variety split.
 */
export function renderCultureSelectOption(option: SearchableSelectOption): ReactNode {
  const parts = option.data as CultureOptionParts | undefined;
  if (!parts) {
    return option.label;
  }
  return <CultureSelectOption cultureName={parts.cultureName} variety={parts.variety} />;
}
