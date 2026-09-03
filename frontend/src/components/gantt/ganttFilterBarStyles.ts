import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

/** Wrapping row that holds the desktop calendar filter controls. */
export const ganttDesktopFilterRowSx: SystemStyleObject<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1.5,
  alignItems: 'center',
};
