import { useEffect, useRef } from 'react';

interface SearchExpandedGroupsOptions {
  /**
   * Row ids of the Kultur groups the running search hit. Empty while no
   * search term is active.
   */
  matchedGroupRowIds: ReadonlySet<string>;
  isExpanded: (rowId: string) => boolean;
  ensureExpanded: (rowId: string) => void;
  collapse: (rowId: string) => void;
  /**
   * Groups that must stay open no matter what the search does — the group
   * holding the current selection, whose row would otherwise disappear from
   * the list while the detail view still shows it.
   */
  keepExpandedRowIds?: ReadonlySet<string>;
}

const EMPTY_ROW_IDS: ReadonlySet<string> = new Set();

/**
 * Opens a Kultur group once — when it becomes a search hit — and leaves it
 * alone afterwards.
 *
 * Collapsing an open group again is the user's call and has to stick for as
 * long as that group keeps matching, so the groups already handled for the
 * running search are remembered here rather than re-derived from the expanded
 * set (which no longer contains a group the user just closed). Dropping out of
 * the results forgets a group, which is what lets a later hit open it again as
 * a fresh one — and what closes the auto-opened groups when the search field
 * is cleared.
 *
 * Only groups this hook actually opened are ever closed again. A group the
 * user had already expanded before searching is theirs, not the search's, and
 * clearing the field must leave it exactly as they left it.
 */
export function useSearchExpandedGroups({
  matchedGroupRowIds,
  isExpanded,
  ensureExpanded,
  collapse,
  keepExpandedRowIds = EMPTY_ROW_IDS,
}: SearchExpandedGroupsOptions): void {
  /** Groups already handled for the running search — hit once, opened at most once. */
  const handledGroupRowIdsRef = useRef<Set<string>>(new Set());
  /** The subset this hook opened itself, and may therefore close again. */
  const autoExpandedGroupRowIdsRef = useRef<Set<string>>(new Set());

  // `isExpanded` and `keepExpandedRowIds` are read as the current state at the
  // moment a group is handled, not as triggers: re-running the effect below on
  // every expand/collapse would undo the user's own toggling. This effect is
  // declared first so the latest values are in place before it runs.
  const isExpandedRef = useRef(isExpanded);
  const keepExpandedRowIdsRef = useRef(keepExpandedRowIds);
  useEffect(() => {
    isExpandedRef.current = isExpanded;
    keepExpandedRowIdsRef.current = keepExpandedRowIds;
  });

  useEffect(() => {
    handledGroupRowIdsRef.current.forEach((rowId) => {
      if (matchedGroupRowIds.has(rowId)) {
        return;
      }
      handledGroupRowIdsRef.current.delete(rowId);
      if (!autoExpandedGroupRowIdsRef.current.delete(rowId)) {
        return;
      }
      if (!keepExpandedRowIdsRef.current.has(rowId)) {
        collapse(rowId);
      }
    });
    matchedGroupRowIds.forEach((rowId) => {
      if (handledGroupRowIdsRef.current.has(rowId)) {
        return;
      }
      handledGroupRowIdsRef.current.add(rowId);
      if (isExpandedRef.current(rowId)) {
        return;
      }
      autoExpandedGroupRowIdsRef.current.add(rowId);
      ensureExpanded(rowId);
    });
  }, [collapse, ensureExpanded, matchedGroupRowIds]);
}
