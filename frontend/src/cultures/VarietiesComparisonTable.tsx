import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Culture } from '../api/types';
import { useTranslation } from '../i18n';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { contextMenuActionsOverlaySx } from '../components/contextMenu/contextMenuIndicatorStyles';
import TableSurface from '../components/layout/TableSurface';
import { getComparisonCellValue, getVaryingComparisonFields } from './varietyComparisonFields';

interface VarietyRow {
  culture: Culture;
  label: string;
}

interface VarietiesComparisonTableProps {
  varieties: VarietyRow[];
  cropCulture: Culture;
  onSelect: (culture: Culture) => void;
  onEdit?: (culture: Culture) => void;
  editActionLabel: string;
}

// Matches the name column of the Fields/Beds hierarchy table: a capped
// width so the column doesn't grow to fit the longest name, with the name
// itself truncating (ellipsis) under a gradient-masked hover overlay
// (contextMenuActionsOverlaySx) instead of reserving permanent space for
// the edit icon.
const stickyNameCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
  maxWidth: { xs: 180, sm: 240 },
  // The sticky cell's own opaque background sits on top of the row, so the
  // row's :hover background (set on the <tr>) wouldn't otherwise show
  // through it — mirror it here so the whole row highlights consistently.
  '.variety-row:hover &, .variety-row:focus-within &': {
    backgroundColor: 'action.selected',
  },
} as const;

export function VarietiesComparisonTable({
  varieties,
  cropCulture,
  onSelect,
  onEdit,
  editActionLabel,
}: VarietiesComparisonTableProps) {
  const { t, i18n } = useTranslation('cultures');
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage ?? i18n.language);
  const varyingFields = getVaryingComparisonFields(varieties.map((variety) => variety.culture), cropCulture);

  const handleRowClick = (event: ReactMouseEvent<HTMLTableRowElement>, culture: Culture): void => {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    onSelect(culture);
  };

  return (
    <TableSurface sizingMode="fullWorkspace">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={stickyNameCellSx}>{t('hierarchy.varietyLabel')}</TableCell>
              {varyingFields.map((field) => (
                <TableCell key={field.id}>{t(field.labelKey)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {varieties.map(({ culture, label }) => (
              <TableRow
                key={culture.id}
                className="variety-row"
                hover
                tabIndex={0}
                onClick={(event) => handleRowClick(event, culture)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSelect(culture);
                  }
                }}
                sx={(theme) => ({
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: theme.palette.action.selected },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                })}
              >
                <TableCell sx={stickyNameCellSx}>
                  <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0, width: '100%', overflow: 'hidden' }}>
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '.variety-row:hover &, .variety-row:focus-within &': {
                          color: 'primary.main',
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {label}
                    </Box>
                    <Box sx={contextMenuActionsOverlaySx('.variety-row:hover &', '.variety-row:focus-within &')}>
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={editActionLabel}
                        disabled={!onEdit}
                        onClick={() => onEdit?.(culture)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </TableCell>
                {varyingFields.map((field) => (
                  <TableCell key={field.id}>
                    {getComparisonCellValue(culture, cropCulture, field, t, locale)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </TableSurface>
  );
}
