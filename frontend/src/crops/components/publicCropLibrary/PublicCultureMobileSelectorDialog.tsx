import { useEffect, useMemo, type FormEvent, type Ref, type UIEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { PublicCulture } from '../../../api/types';
import { useTranslation } from '../../../i18n';
import { buildCropHierarchy, getFirstVarietyItem, type CropHierarchyItemKind } from '../../../cultures/cropHierarchy';
import { flattenTreeRows } from '../../../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../../../components/hierarchy/hooks/useExpandedState';
import { CropHierarchyExpandToggle } from '../../../cultures/CropHierarchyExpandToggle';
import { useOverlayHistory } from '../../../hooks/useOverlayHistory';
import { getPublicCultureTitle } from '../../publicCultureDisplay';

export interface PublicCultureMobileSelectorDialogProps {
  open: boolean;
  query: string;
  cultures: PublicCulture[];
  loading: boolean;
  error: string;
  selectedCultureId: number | null;
  selectedSpeciesViewKey?: string | null;
  listRef: Ref<HTMLUListElement>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (culture: PublicCulture, itemKind: CropHierarchyItemKind, speciesKey: string) => void;
  onListScroll: (event: UIEvent<HTMLUListElement>) => void;
}

export function PublicCultureMobileSelectorDialog({
  open,
  query,
  cultures,
  loading,
  error,
  selectedCultureId,
  selectedSpeciesViewKey = null,
  listRef,
  onClose,
  onQueryChange,
  onSearchSubmit,
  onSelect,
  onListScroll,
}: PublicCultureMobileSelectorDialogProps) {
  const { t, i18n } = useTranslation('cultures');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const {
    expandedRows,
    toggleExpand,
    ensureExpanded,
  } = useExpandedState('publicCropLibraryMobile');
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
  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    hierarchyItems.forEach((item) => {
      if (item.kind === 'variety' && item.parentId) {
        ensureExpanded(item.parentId);
      }
    });
  }, [ensureExpanded, hierarchyItems, query]);
  const visibleRows = useMemo(
    () => flattenTreeRows(hierarchyItems, { expandedIds: expandedRows }),
    [expandedRows, hierarchyItems],
  );

  useOverlayHistory({
    open,
    onClose,
    historyKey: 'openFarmPlannerPublicCultureSelector',
  });

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>{t('selectCulture')}</DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        <Box component="form" onSubmit={onSearchSubmit} sx={{ mb: 1.5 }}>
          <TextField
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            label={t('library.searchLabel')}
            size="medium"
            fullWidth
          />
        </Box>
        {loading ? (
          <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stack spacing={1} sx={{ alignItems: "center", }} >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">{t('messages.loadingCultures')}</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : cultures.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('library.emptyState.noResultsTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('library.empty')}
            </Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            dense
            disablePadding
            role="listbox"
            aria-label={t('library.page.title')}
            onScroll={onListScroll}
            sx={{ py: 0.5, px: 0.25, overflowY: 'auto' }}
          >
            {visibleRows.map(({ node, depth, hasChildren }) => {
              const culture = node.culture;
              // A species row with no dedicated varietyless entry has nothing of its
              // own to select — but it always has at least one variety underneath it,
              // so tapping it selects that first variety instead of doing nothing.
              // Mirrors the desktop list (PublicCropLibraryPage.tsx).
              const firstVarietyCulture = !culture
                ? getFirstVarietyItem(hierarchyItems, node.id)?.culture ?? null
                : null;
              const isClickable = culture?.id !== undefined || firstVarietyCulture !== null;
              const isRowSelected = Boolean(
                culture?.id !== undefined
                && culture.id === selectedCultureId
                && (node.kind === 'species'
                  ? selectedSpeciesViewKey === node.speciesKey || !(culture.variety || '').trim()
                  : selectedSpeciesViewKey !== node.speciesKey),
              );
              return (
                <ListItemButton
                  key={`mobile-public-${node.id}`}
                  role={isClickable ? 'option' : 'presentation'}
                  aria-label={node.kind === 'species'
                    ? node.label
                    : culture ? getPublicCultureTitle(culture, language, t('library.translation.missingName')) : undefined}
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
                    mb: 0.125,
                    ml: `calc(${depth * 1.75}rem)`,
                    pl: 0.75,
                    py: 0.25,
                  }}
                >
                  <CropHierarchyExpandToggle
                    hasChildren={hasChildren}
                    isExpanded={expandedRows.has(node.id)}
                    onToggle={() => toggleExpand(node.id)}
                    expandLabel={t('hierarchy.expandCrop')}
                    collapseLabel={t('hierarchy.collapseCrop')}
                  />
                  <ListItemText
                    primary={node.kind === 'species'
                      ? node.label
                      : node.label || (culture ? getPublicCultureTitle(culture, language, t('library.translation.missingName')) : '')}
                    secondary={node.kind === 'species'
                      ? [
                        culture?.crop_family,
                        node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                      ].filter(Boolean).join(' • ') || undefined
                      : undefined}
                    slotProps={{
                      primary: { sx: { fontSize: '0.95rem', fontWeight: node.kind === 'species' ? 700 : 500, lineHeight: 1.2 } },
                      secondary: { sx: { fontSize: '0.8rem', color: 'text.secondary' } }
                    }}
                    sx={{ my: 0 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 1.5, py: 1 }}>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}
