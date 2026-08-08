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

const stickyNameCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
} as const;

// The edit icon's slot is always laid out (just invisible until hover/focus)
// rather than absolutely overlaid on top of the name, so it never overlaps a
// long variety name and never shifts the row's layout when it appears.
const editActionSlotSx = {
  display: 'inline-flex',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 120ms ease-in-out',
  '.variety-row:hover &, .variety-row:focus-within &': {
    opacity: 1,
    pointerEvents: 'auto',
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
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={stickyNameCellSx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{label}</Box>
                    <Box sx={editActionSlotSx}>
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
