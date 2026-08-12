import { Box } from '@mui/material';
import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import { AppTooltip } from '../AppTooltip';

export const CALCULATED_COLUMN_CELL_CLASS = 'ofp-cell-calculated';
export const CALCULATED_COLUMN_HEADER_CLASS = 'ofp-header-calculated';

const CALCULATED_COLUMN_HEADER_LABEL_SX = { fontWeight: 600 };

export type DataGridColumnState = 'calculated';

interface CalculatedColumnConfig {
  headerName: string;
  tooltip: string;
}

export function getCalculatedColumnProps<Row extends GridValidRowModel>({
  headerName,
  tooltip,
}: CalculatedColumnConfig): Pick<GridColDef<Row>, 'cellClassName' | 'description' | 'editable' | 'headerClassName' | 'renderHeader'> {
  return {
    editable: false,
    description: tooltip,
    headerClassName: CALCULATED_COLUMN_HEADER_CLASS,
    cellClassName: CALCULATED_COLUMN_CELL_CLASS,
    renderHeader: () => (
      <AppTooltip title={tooltip}>
        <Box component="span" sx={CALCULATED_COLUMN_HEADER_LABEL_SX}>
          {headerName}
        </Box>
      </AppTooltip>
    ),
  };
}
