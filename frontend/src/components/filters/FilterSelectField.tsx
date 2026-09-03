import type { ReactElement, ReactNode } from 'react';
import { FormControl, InputLabel } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

import { TypeaheadSelect } from '../inputs/TypeaheadSelect';
import type { TypeaheadSelectProps } from '../inputs/TypeaheadSelect';

type FilterSelectFieldProps<Value> = Omit<TypeaheadSelectProps<Value>, 'labelId' | 'label' | 'fullWidth' | 'ref'> & {
  /** Field id; the label element gets `${id}-label` and the select points at it. */
  id: string;
  label: string;
  /** Layout within the popover's field grid, e.g. a full-width row. */
  sx?: SxProps<Theme>;
  /** The `MenuItem`s — every filter builds its own options. */
  children: ReactNode;
};

/**
 * One labelled select in a filter popover. The filter popovers differ in
 * which fields they offer and how they build their options, not in how a
 * single field is wired up, so the `FormControl`/`InputLabel`/`labelId`
 * plumbing lives here.
 */
export function FilterSelectField<Value>({
  id,
  label,
  sx,
  children,
  ...selectProps
}: FilterSelectFieldProps<Value>): ReactElement {
  const labelId = `${id}-label`;

  return (
    <FormControl size="small" sx={sx}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <TypeaheadSelect fullWidth labelId={labelId} label={label} {...selectProps}>
        {children}
      </TypeaheadSelect>
    </FormControl>
  );
}
