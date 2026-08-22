import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import type { TFunction } from 'i18next';

import type { Culture } from '../api/api';
import { useOverlayHistory } from '../hooks/useOverlayHistory';
import { getCultureDisplayName } from './cultureDisplay';
import { buildCropHierarchy, getFirstVarietyItem, type CropHierarchyItemKind } from './cropHierarchy';
import { flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { CropHierarchyExpandToggle } from './CropHierarchyExpandToggle';

interface CultureMobileSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The shared search/filter control rendered above the list. */
  selectorControl: ReactNode;
  cultures: Culture[];
  selectedCultureId: number | undefined;
  selectedSpeciesViewKey?: string | null;
  onSelect: (culture: Culture, itemKind: CropHierarchyItemKind, speciesKey: string) => void;
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
  } = useExpandedState('projectCropLibraryMobile');
  const hierarchyItems = useMemo(() => buildCropHierarchy(cultures), [cultures]);
  useEffect(() => {
    const selectedVariety = hierarchyItems.find((item) => (
      item.kind === 'variety'
      && item.culture?.id === selectedCultureId
      && selectedSpeciesViewKey !== item.speciesKey
    ));
    if (!selectedVariety?.parentId) {
      return;
    }
    ensureExpanded(selectedVariety.parentId);
  }, [ensureExpanded, hierarchyItems, selectedCultureId, selectedSpeciesViewKey]);
  const visibleRows = useMemo(
    () => flattenTreeRows(hierarchyItems, { expandedIds: expandedRows }),
    [expandedRows, hierarchyItems],
  );

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>{t('selectCulture')}</DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        {selectorControl}
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
                sx={{ borderRadius: 1.25, mb: 0.375, pl: `calc(${0.75 + depth * 0.85}rem)` }}
              >
                <CropHierarchyExpandToggle
                  hasChildren={hasChildren}
                  isExpanded={expandedRows.has(node.id)}
                  onToggle={() => toggleExpand(node.id)}
                  expandLabel={t('hierarchy.expandCrop')}
                  collapseLabel={t('hierarchy.collapseCrop')}
                />
                <ListItemText
                  primary={node.kind === 'species' ? node.label : node.label || (culture ? getCultureDisplayName(culture) : '')}
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
