import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import type { TFunction } from 'i18next';

import type { Culture } from '../api/api';
import { useOverlayHistory } from '../hooks/useOverlayHistory';
import { getCultureDisplayName } from './cultureDisplay';
import { buildCropHierarchy, getFirstVarietyItem, type CropHierarchyItemKind } from './cropHierarchy';
import { flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { CropHierarchyExpandToggle } from './CropHierarchyExpandToggle';
import {
  MOBILE_ROW_MIN_HEIGHT,
  MOBILE_TOUCH_TARGET_SIZE,
  mobileCropChevronButtonSx,
} from './cropHierarchyRowSx';
import { HighlightedText } from '../components/HighlightedText';
import { useSearchExpandedGroups } from './useSearchExpandedGroups';

const EMPTY_MATCHED_GROUP_ROW_IDS: ReadonlySet<string> = new Set();

interface CultureMobileSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The shared search/filter control rendered above the list. */
  selectorControl: ReactNode;
  cultures: Culture[];
  selectedCultureId: number | undefined;
  selectedSpeciesViewKey?: string | null;
  onSelect: (culture: Culture, itemKind: CropHierarchyItemKind, speciesKey: string) => void;
  /** Lower-cased search needle: marks the hits and opens the groups they sit in. */
  highlightQuery?: string;
  /** Row ids of the Kultur groups the running search hit. */
  matchedGroupRowIds?: ReadonlySet<string>;
  t: TFunction<'cultures'>;
}

/**
 * Presentational full-screen culture picker for the unified mobile layout.
 * State (open flag, filtered cultures, selected culture) and the select
 * handler live in CultureDetail.tsx; this component only renders.
 */
export function CultureMobileSelectorDialog({
  open,
  onClose,
  selectorControl,
  cultures,
  selectedCultureId,
  selectedSpeciesViewKey = null,
  onSelect,
  highlightQuery,
  matchedGroupRowIds = EMPTY_MATCHED_GROUP_ROW_IDS,
  t,
}: CultureMobileSelectorDialogProps) {
  useOverlayHistory({
    open,
    onClose,
    historyKey: 'openFarmPlannerCultureSelector',
  });
  const {
    expandedRows,
    toggleExpand,
    ensureExpanded,
    collapse,
  } = useExpandedState('projectCropLibraryMobile');
  const hierarchyItems = useMemo(() => buildCropHierarchy(cultures), [cultures]);
  // The group holding the selected Sorte: kept open so the selected row can
  // never drop out of the list while the detail view still shows it.
  const selectedVarietyGroupRowIds = useMemo(() => {
    const selectedVariety = hierarchyItems.find((item) => (
      item.kind === 'variety'
      && item.culture?.id === selectedCultureId
      && selectedSpeciesViewKey !== item.speciesKey
    ));
    return selectedVariety?.parentId ? new Set([selectedVariety.parentId]) : new Set<string>();
  }, [hierarchyItems, selectedCultureId, selectedSpeciesViewKey]);
  useEffect(() => {
    selectedVarietyGroupRowIds.forEach((rowId) => ensureExpanded(rowId));
  }, [ensureExpanded, selectedVarietyGroupRowIds]);
  useSearchExpandedGroups({
    matchedGroupRowIds,
    isExpanded: (rowId) => expandedRows.has(rowId),
    ensureExpanded,
    collapse,
    keepExpandedRowIds: selectedVarietyGroupRowIds,
  });
  const visibleRows = useMemo(
    () => flattenTreeRows(hierarchyItems, { expandedIds: expandedRows }),
    [expandedRows, hierarchyItems],
  );

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>{t('selectCulture')}</DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        {selectorControl}
        {visibleRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 2 }}>
            {t('noOptionsEnhanced')}
          </Typography>
        ) : null}
        <List dense sx={{ py: 0.5, px: 0.25, overflowY: 'auto' }}>
          {visibleRows.map(({ node, depth, hasChildren }) => {
            const culture = node.culture;
            // A species row with no dedicated varietyless entry has nothing of its own
            // to select — but it always has at least one variety underneath it, so
            // tapping it selects that first variety instead of doing nothing. Mirrors
            // the public crop library's mobile selector (PublicCultureMobileSelectorDialog.tsx).
            const firstVarietyCulture = !culture
              ? getFirstVarietyItem(hierarchyItems, node.id)?.culture ?? null
              : null;
            const isClickable = culture?.id !== undefined || firstVarietyCulture !== null;
            const rowLabel = node.kind === 'species'
              ? node.label
              : node.label || (culture ? getCultureDisplayName(culture) : '');
            const isRowSelected = Boolean(
              culture?.id !== undefined
              && selectedCultureId === culture.id
              && (node.kind === 'species'
                ? selectedSpeciesViewKey === node.speciesKey || !(culture.variety || '').trim()
                : selectedSpeciesViewKey !== node.speciesKey),
            );
            return (
              <ListItemButton
                key={`mobile-${node.id}`}
                role={isClickable ? 'option' : 'presentation'}
                aria-label={node.kind === 'species' ? node.label : undefined}
                aria-selected={isClickable ? isRowSelected : undefined}
                selected={isRowSelected}
                disabled={!isClickable}
                onClick={() => {
                  if (culture) {
                    onSelect(culture, node.kind, node.speciesKey);
                  } else if (firstVarietyCulture) {
                    ensureExpanded(node.id);
                    onSelect(firstVarietyCulture, 'variety', node.speciesKey);
                  }
                }}
                onDoubleClick={(event) => {
                  if (!hasChildren) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  toggleExpand(node.id);
                }}
                sx={{
                  borderRadius: 1.25,
                  mb: 0.375,
                  pl: `calc(${0.75 + depth * 0.85}rem)`,
                  minHeight: MOBILE_ROW_MIN_HEIGHT,
                }}
              >
                <CropHierarchyExpandToggle
                  hasChildren={hasChildren}
                  isExpanded={expandedRows.has(node.id)}
                  onToggle={() => toggleExpand(node.id)}
                  expandLabel={t('hierarchy.expandCrop')}
                  collapseLabel={t('hierarchy.collapseCrop')}
                  sx={mobileCropChevronButtonSx}
                  placeholderWidth={MOBILE_TOUCH_TARGET_SIZE}
                />
                <ListItemText
                  primary={highlightQuery
                    ? <HighlightedText text={rowLabel} query={highlightQuery} />
                    : rowLabel}
                  slotProps={{
                    primary: { sx: { fontSize: '0.95rem', fontWeight: node.kind === 'species' ? 700 : 500 } },
                  }} />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
