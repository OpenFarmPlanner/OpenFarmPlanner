import { useEffect, useRef } from 'react';

interface SearchExpandedGroupsOptions {
  /**
   * Row ids of the Kultur groups the running search hit. Empty while no
   * search term is active.
   */
  matchedGroupRowIds: ReadonlySet<string>;
  ensureExpanded: (rowId: string) => void;
  collapse: (rowId: string) => void;
}

/**
 * Opens a Kultur group once — when it becomes a search hit — and leaves it
 * alone afterwards.
 *
 * Collapsing an open group again is the user's call and has to stick for as
 * long as that group keeps matching, so the groups already opened for the
 * running search are remembered here rather than re-derived from the expanded
 * set (which no longer contains a group the user just closed). Dropping out of
 * the results forgets a group, which is what lets a later hit open it again as
 * a fresh one — and what closes the auto-opened groups when the search field
 * is cleared.
 */
export function useSearchExpandedGroups({
  matchedGroupRowIds,
  ensureExpanded,
  collapse,
}: SearchExpandedGroupsOptions): void {
  const autoExpandedGroupRowIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    autoExpandedGroupRowIdsRef.current.forEach((rowId) => {
      if (matchedGroupRowIds.has(rowId)) {
        return;
      }
      autoExpandedGroupRowIdsRef.current.delete(rowId);
      collapse(rowId);
    });
    matchedGroupRowIds.forEach((rowId) => {
      if (autoExpandedGroupRowIdsRef.current.has(rowId)) {
        return;
      }
      autoExpandedGroupRowIdsRef.current.add(rowId);
      ensureExpanded(rowId);
    });
  }, [collapse, ensureExpanded, matchedGroupRowIds]);
}
