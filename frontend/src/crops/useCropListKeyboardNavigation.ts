import { useCallback, useId, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react';

type CropListItemId = number | string;

interface CropListKeyboardNavigationOptions<TItem> {
  items: TItem[];
  selectedId: CropListItemId | null | undefined;
  getId: (item: TItem) => CropListItemId | null | undefined;
  onSelect: (item: TItem) => void;
  autoFocusSelected?: boolean;
}

export interface CropListItemProps {
  id: string;
  ref: (element: HTMLElement | null) => (() => void) | undefined;
  role: 'option';
  'aria-selected': boolean;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface CropListProps {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function createDomId(prefix: string, value: CropListItemId): string {
  return `${prefix}-option-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function useCropListKeyboardNavigation<TItem>({
  items,
  selectedId,
  getId,
  onSelect,
  autoFocusSelected = false,
}: CropListKeyboardNavigationOptions<TItem>) {
  const listDomId = useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  const itemRefs = useRef<Map<CropListItemId, HTMLElement>>(new Map());

  const fallbackFocusId = useMemo(() => {
    if (selectedId !== null && selectedId !== undefined && items.some((item) => getId(item) === selectedId)) {
      return selectedId;
    }
    const [firstItem] = items;
    return firstItem ? getId(firstItem) : null;
  }, [getId, items, selectedId]);

  const focusItem = useCallback((id: CropListItemId): void => {
    const element = itemRefs.current.get(id);
    element?.scrollIntoView?.({ block: 'nearest' });
    element?.focus?.({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (selectedId === null || selectedId === undefined) {
      return;
    }
    if (autoFocusSelected) {
      if (itemRefs.current.has(selectedId)) {
        focusItem(selectedId);
        return;
      }
      // The selected row's own element isn't mounted yet — it may still be
      // hidden behind a collapsed parent that another effect is about to
      // expand in this same commit. Retry once the resulting re-render (and
      // any expansion it triggers) has painted, instead of silently giving
      // up on the initial focus.
      const raf = requestAnimationFrame(() => focusItem(selectedId));
      return () => cancelAnimationFrame(raf);
    }
    itemRefs.current.get(selectedId)?.scrollIntoView?.({ block: 'nearest' });
  }, [autoFocusSelected, focusItem, selectedId]);

  const getFocusedItemId = useCallback((target: EventTarget | null): CropListItemId | null => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    for (const [id, element] of itemRefs.current.entries()) {
      if (element === target || element.contains(target)) {
        return id;
      }
    }
    return null;
  }, []);

  const selectItem = useCallback((item: TItem, focusAfterSelect = true): void => {
    const id = getId(item);
    if (id === null || id === undefined) {
      return;
    }
    onSelect(item);
    const schedule = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    schedule(() => {
      const element = itemRefs.current.get(id);
      if (element) {
        element.scrollIntoView?.({ block: 'nearest' });
        if (focusAfterSelect) {
          element.focus?.({ preventScroll: true });
        }
        return;
      }
      // The newly selected row may still be hidden behind a collapsed parent
      // that an effect (triggered by onSelect above) is about to expand in a
      // later commit — retry once that expansion has painted instead of
      // silently dropping focus (see the mount-focus effect for the same
      // pattern).
      schedule(() => {
        const retryElement = itemRefs.current.get(id);
        retryElement?.scrollIntoView?.({ block: 'nearest' });
        if (focusAfterSelect) {
          retryElement?.focus?.({ preventScroll: true });
        }
      });
    });
  }, [getId, onSelect]);

  const moveSelection = useCallback((key: string, focusedId: CropListItemId | null | undefined): void => {
    if (items.length === 0) {
      return;
    }

    const selectedIndex = items.findIndex((item) => getId(item) === selectedId);
    const focusedIndex = items.findIndex((item) => getId(item) === focusedId);
    // Focus wins over selection: a list can contain rows that take focus
    // without changing the selection (a Kultur group header with no general
    // entry of its own), and moving on from such a row has to continue from
    // where the focus actually is, not jump back to the selected row.
    const currentIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex;
    let nextIndex = currentIndex;

    if (key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
    } else if (key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = items.length - 1;
    }

    const nextItem = items[nextIndex];
    const nextId = nextItem ? getId(nextItem) : null;
    if (!nextItem || nextId === null || nextId === undefined || nextId === selectedId) {
      if (nextId !== null && nextId !== undefined) {
        focusItem(nextId);
      }
      return;
    }

    selectItem(nextItem);
  }, [focusItem, getId, items, selectItem, selectedId]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, focusedId: CropListItemId | null | undefined): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) {
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    moveSelection(event.key, focusedId);
  }, [moveSelection]);

  const getItemProps = useCallback((item: TItem): CropListItemProps => {
    const id = getId(item);
    const isSelected = id !== null && id !== undefined && id === selectedId;

    return {
      id: id === null || id === undefined ? '' : createDomId(listDomId, id),
      ref: (element: HTMLElement | null) => {
        if (id === null || id === undefined || !element) {
          return undefined;
        }
        itemRefs.current.set(id, element);
        return () => {
          itemRefs.current.delete(id);
        };
      },
      role: 'option',
      'aria-selected': isSelected,
      tabIndex: id !== null && id !== undefined && id === fallbackFocusId ? 0 : -1,
      onKeyDown: (event) => handleKeyDown(event, id),
    };
  }, [fallbackFocusId, getId, handleKeyDown, listDomId, selectedId]);

  const getListProps = useCallback((): CropListProps => ({
    onKeyDown: (event) => {
      handleKeyDown(event, getFocusedItemId(event.target));
    },
  }), [getFocusedItemId, handleKeyDown]);

  return {
    focusItem,
    getListProps,
    getItemProps,
    selectItem,
  };
}
