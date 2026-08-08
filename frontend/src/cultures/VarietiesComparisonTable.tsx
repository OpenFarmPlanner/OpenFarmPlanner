import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
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
}

// Reveals the name's link styling for *genuine* keyboard navigation onto the
// row, without it staying stuck on after a mouse click (rows have no other
// focusable element anymore, but a `:focus-visible`-based condition is kept
// here rather than plain `:focus` so a mouse click doesn't show it either —
// consistent with how focus rings behave everywhere else in the app).
const VARIETY_ROW_KEYBOARD_FOCUS_SELECTOR = '.variety-row:focus-visible &';

// Matches the name column of the Fields/Beds hierarchy table: a capped
// width so the column doesn't grow to fit the longest name, with the name
// itself truncating (ellipsis) if it doesn't fit.
const stickyNameCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
  maxWidth: { xs: 180, sm: 240 },
  // The sticky cell's own opaque background sits on top of the row, so the
  // row's :hover background (set on the <tr>) wouldn't otherwise show
  // through it — mirror it here so the whole row highlights consistently.
  [`.variety-row:hover &, ${VARIETY_ROW_KEYBOARD_FOCUS_SELECTOR}`]: {
    backgroundColor: 'action.selected',
  },
} as const;

export function VarietiesComparisonTable({
  varieties,
  cropCulture,
  onSelect,
}: VarietiesComparisonTableProps) {
  const { t, i18n } = useTranslation('cultures');
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage ?? i18n.language);
  const varyingFields = getVaryingComparisonFields(varieties.map((variety) => variety.culture), cropCulture);

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
                onClick={() => onSelect(culture)}
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
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      [`.variety-row:hover &, ${VARIETY_ROW_KEYBOARD_FOCUS_SELECTOR}`]: {
                        color: 'primary.main',
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {label}
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
