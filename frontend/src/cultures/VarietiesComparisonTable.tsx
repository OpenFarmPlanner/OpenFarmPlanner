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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  onDelete?: (culture: Culture) => void;
  editActionLabel: string;
  deleteActionLabel: string;
}

const stickyNameCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
} as const;

export function VarietiesComparisonTable({
  varieties,
  cropCulture,
  onSelect,
  onEdit,
  onDelete,
  editActionLabel,
  deleteActionLabel,
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
                  <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 'fit-content', maxWidth: '100%' }}>
                    <Box component="span" sx={{ pr: 1 }}>{label}</Box>
                    <Box
                      sx={contextMenuActionsOverlaySx('.variety-row:hover &', '.variety-row:focus-within &')}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={editActionLabel}
                        disabled={!onEdit}
                        onClick={() => onEdit?.(culture)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={deleteActionLabel}
                        disabled={!onDelete}
                        onClick={() => onDelete?.(culture)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
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
