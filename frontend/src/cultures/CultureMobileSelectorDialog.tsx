import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import type { TFunction } from 'i18next';

import type { Culture } from '../api/api';
import { useOverlayHistory } from '../hooks/useOverlayHistory';
import { getCultureDisplayName } from './cultureDisplay';
import { buildCropHierarchy, type CropHierarchyItemKind } from './cropHierarchy';
import { flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';

const cropChevronButtonSx = {
  width: 30,
  height: 30,
  minWidth: 30,
  p: 0,
  mr: 0.5,
  color: 'text.primary',
  opacity: 0.72,
  flexShrink: 0,
  '&:hover': {
    opacity: 1,
    bgcolor: 'rgba(37, 111, 42, 0.08)',
  },
} as const;

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
                role={culture ? 'option' : 'presentation'}
                aria-label={node.kind === 'species' ? node.label : undefined}
                aria-selected={culture ? isRowSelected : undefined}
                selected={isRowSelected}
                disabled={!culture}
                onClick={() => {
                  if (culture) {
                    onSelect(culture, node.kind, node.speciesKey);
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
                {hasChildren ? (
                  <IconButton
                    size="small"
                    aria-label={expandedRows.has(node.id) ? t('hierarchy.collapseCrop') : t('hierarchy.expandCrop')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleExpand(node.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    sx={cropChevronButtonSx}
                  >
                    {expandedRows.has(node.id) ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                  </IconButton>
                ) : (
                  <Box component="span" sx={{ width: 24, flexShrink: 0 }} />
                )}
                <ListItemText
                  primary={node.kind === 'species' ? node.label : node.label || (culture ? getCultureDisplayName(culture) : '')}
                  secondary={node.kind === 'species'
                    ? [
                      culture?.crop_family,
                      node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                    ].filter(Boolean).join(' • ') || undefined
                    : undefined}
                  primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: node.kind === 'species' ? 700 : 500 }}
                  secondaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary' }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
