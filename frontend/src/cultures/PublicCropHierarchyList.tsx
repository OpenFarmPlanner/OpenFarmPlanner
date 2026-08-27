import { useEffect, useMemo, type ReactNode, type Ref, type UIEvent } from 'react';
import { List, Typography, type SxProps, type Theme } from '@mui/material';
import type { PublicCulture } from '../api/types';
import { useTranslation } from '../i18n';
import { buildCropHierarchy, getCropSpeciesKey, getFirstVarietyItem, type CropHierarchyItemKind } from './cropHierarchy';
import { flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { useCultureListKeyboardNavigation } from './useCultureListKeyboardNavigation';
import { useSearchExpandedGroups } from './useSearchExpandedGroups';
import { CropHierarchyRow } from './CropHierarchyRow';
import { getPublicCultureTitle } from '../crops/publicCultureDisplay';
import { CropSpeciesPendingChip } from './CropSpeciesPendingChip';
import { isCropSpeciesPending } from './cropSpeciesPending';
import { getSearchMatchedHierarchyGroupRowIds } from './cultureGroupSearch';
import { normalizePublicCultureSearchQuery } from './publicCultureSearchMatch';

interface PublicCropHierarchyListProps {
  cultures: PublicCulture[];
  selectedCultureId: number | null;
  isSpeciesView: boolean;
  onSelect: (culture: PublicCulture, meta: { kind: CropHierarchyItemKind; speciesKey: string }) => void;
  ariaLabel: string;
  /** Persists expand/collapse state across remounts under this session-storage key; left in-memory-only when omitted. */
  storageKey?: string;
  /** When non-empty, ancestor rows of every matching entry are auto-expanded — mirrors search-result reveal behavior. */
  searchQuery?: string;
  autoFocusSelected?: boolean;
  emptyState?: ReactNode;
  dense?: boolean;
  sx?: SxProps<Theme>;
  listRef?: Ref<HTMLUListElement>;
  onScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

/**
 * Hierarchical crop -> variety list (with "(count)" badge and expand/collapse),
 * shared by the full public crop library page and the "import from library"
 * dialog so both present the exact same tree/list behavior.
 */
export function PublicCropHierarchyList({
  cultures,
  selectedCultureId,
  isSpeciesView,
  onSelect,
  ariaLabel,
  storageKey,
  searchQuery,
  autoFocusSelected = false,
  emptyState,
  dense = false,
  sx,
  listRef,
  onScroll,
}: PublicCropHierarchyListProps) {
  const { t, i18n } = useTranslation('cultures');
  const language = i18n.resolvedLanguage ?? i18n.language;

  const {
    expandedRows: expandedRowIds,
    toggleExpand: toggleRow,
    ensureExpanded: ensureRowExpanded,
    collapse: collapseRow,
  } = useExpandedState(storageKey);

  const normalizedSearchQuery = normalizePublicCultureSearchQuery(searchQuery ?? '');
  const cropHierarchyItems = useMemo(() => buildCropHierarchy(cultures), [cultures]);

  const selectedCulture = useMemo(
    () => (selectedCultureId === null ? null : cultures.find((culture) => culture.id === selectedCultureId) ?? null),
    [cultures, selectedCultureId],
  );

  const selectedVarietyGroupRowIds = useMemo(
    () => (selectedCulture?.variety && !isSpeciesView
      ? new Set([`species:${getCropSpeciesKey(selectedCulture)}`])
      : new Set<string>()),
    [isSpeciesView, selectedCulture],
  );

  useEffect(() => {
    if (!selectedCulture?.variety || isSpeciesView) {
      return;
    }
    const varietyItem = cropHierarchyItems.find((item) => item.kind === 'variety' && item.culture?.id === selectedCulture.id);
    if (varietyItem?.parentId) {
      ensureRowExpanded(varietyItem.parentId);
    }
  }, [cropHierarchyItems, ensureRowExpanded, isSpeciesView, selectedCulture]);

  useEffect(() => {
    selectedVarietyGroupRowIds.forEach((rowId) => ensureRowExpanded(rowId));
  }, [ensureRowExpanded, selectedVarietyGroupRowIds]);

  const matchedGroupRowIds = useMemo(
    () => getSearchMatchedHierarchyGroupRowIds(cropHierarchyItems, normalizedSearchQuery),
    [cropHierarchyItems, normalizedSearchQuery],
  );

  useSearchExpandedGroups({
    matchedGroupRowIds,
    isExpanded: (rowId) => expandedRowIds.has(rowId),
    ensureExpanded: ensureRowExpanded,
    collapse: collapseRow,
    keepExpandedRowIds: selectedVarietyGroupRowIds,
  });

  const visibleRows = useMemo(
    () => flattenTreeRows(cropHierarchyItems, { expandedIds: expandedRowIds }),
    [cropHierarchyItems, expandedRowIds],
  );

  const navigableRows = useMemo(
    () => visibleRows.map((row) => row.node),
    [visibleRows],
  );

  const selectedRowId = selectedCulture
    ? (isSpeciesView ? `species:${getCropSpeciesKey(selectedCulture)}` : `culture:${selectedCulture.id}`)
    : null;

  const listNavigation = useCultureListKeyboardNavigation({
    items: navigableRows,
    selectedId: selectedRowId,
    getId: (item) => item.id,
    onSelect: (item) => {
      if (item.culture) {
        onSelect(item.culture, { kind: item.kind, speciesKey: item.speciesKey });
      }
    },
    autoFocusSelected,
  });

  if (visibleRows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <List
      ref={listRef}
      {...listNavigation.getListProps()}
      dense={dense}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={onScroll}
      sx={sx}
    >
      {visibleRows.map(({ node, depth, hasChildren }) => {
        const culture = node.culture;
        // A species row with no dedicated varietyless entry (culture === null) has
        // nothing of its own to show, but always has at least one variety
        // underneath it — clicking it selects that first variety instead of
        // leaving the row inert.
        const firstVarietyCulture = !culture
          ? getFirstVarietyItem(cropHierarchyItems, node.id)?.culture ?? null
          : null;
        const isClickable = culture?.id !== undefined || firstVarietyCulture !== null;
        const itemProps = isClickable ? listNavigation.getItemProps(node) : {};
        // A proposed species is pending for every entry beneath it, so the
        // marker sits on the species row — including species rows that only
        // exist through their varieties.
        const showPendingMarker = node.kind === 'species'
          && isCropSpeciesPending(culture ?? firstVarietyCulture);
        const isRowSelected = Boolean(
          culture?.id !== undefined
          && culture.id === selectedCultureId
          && (node.kind === 'species' ? isSpeciesView : !isSpeciesView),
        );
        return (
          <CropHierarchyRow
            key={node.id}
            itemProps={itemProps}
            depth={depth}
            hasChildren={hasChildren}
            isExpanded={expandedRowIds.has(node.id)}
            onToggleExpand={() => toggleRow(node.id)}
            expandLabel={t('hierarchy.expandCrop')}
            collapseLabel={t('hierarchy.collapseCrop')}
            isSelected={isRowSelected}
            isClickable={isClickable}
            ariaLabel={node.kind === 'species'
              ? node.label
              : culture ? getPublicCultureTitle(culture, language, t('library.translation.missingName')) : undefined}
            primary={node.label}
            isPrimaryEmphasized={node.kind === 'species'}
            secondary={undefined}
            varietyCount={node.kind === 'species' ? node.varietyCount : undefined}
            showZeroVarietyCount={node.kind === 'species' && Boolean(normalizedSearchQuery)}
            highlightQuery={normalizedSearchQuery}
            endAdornment={showPendingMarker ? <CropSpeciesPendingChip iconOnly /> : undefined}
            isPendingSuggestion={showPendingMarker}
            onKeyboardActivate={() => {
              if (node.kind !== 'species' || !hasChildren) {
                return false;
              }
              toggleRow(node.id);
              return true;
            }}
            onClick={() => {
              if (culture?.id !== undefined) {
                listNavigation.selectItem(node);
              } else if (firstVarietyCulture) {
                ensureRowExpanded(node.id);
                onSelect(firstVarietyCulture, { kind: 'variety', speciesKey: node.speciesKey });
              }
            }}
            onDoubleClick={(event) => {
              if (!hasChildren) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              toggleRow(node.id);
            }}
          />
        );
      })}
    </List>
  );
}

export function PublicCropHierarchyEmpty({ message }: { message: string }) {
  return <Typography color="text.secondary" sx={{ p: 2 }}>{message}</Typography>;
}
