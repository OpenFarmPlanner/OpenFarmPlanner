import { useCallback, useId, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react';

type CultureListItemId = number | string;

interface CultureListKeyboardNavigationOptions<TItem> {
  items: TItem[];
  selectedId: CultureListItemId | null | undefined;
  getId: (item: TItem) => CultureListItemId | null | undefined;
  onSelect: (item: TItem) => void;
  autoFocusSelected?: boolean;
}

interface CultureListItemProps {
  id: string;
  ref: (element: HTMLElement | null) => (() => void) | undefined;
  role: 'option';
  'aria-selected': boolean;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface CultureListProps {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function createDomId(prefix: string, value: CultureListItemId): string {
  return `${prefix}-option-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function useCultureListKeyboardNavigation<TItem>({
  items,
  selectedId,
  getId,
  onSelect,
  autoFocusSelected = false,
}: CultureListKeyboardNavigationOptions<TItem>) {
  const listDomId = useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  const itemRefs = useRef<Map<CultureListItemId, HTMLElement>>(new Map());

  const fallbackFocusId = useMemo(() => {
    if (selectedId !== null && selectedId !== undefined && items.some((item) => getId(item) === selectedId)) {
      return selectedId;
    }
    const [firstItem] = items;
    return firstItem ? getId(firstItem) : null;
  }, [getId, items, selectedId]);

  const focusItem = useCallback((id: CultureListItemId): void => {
    const element = itemRefs.current.get(id);
    element?.scrollIntoView?.({ block: 'nearest' });
    element?.focus?.({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (selectedId === null || selectedId === undefined) {
      return;
    }
    if (autoFocusSelected) {
      focusItem(selectedId);
      return;
    }
    itemRefs.current.get(selectedId)?.scrollIntoView?.({ block: 'nearest' });
  }, [autoFocusSelected, focusItem, selectedId]);

  const getFocusedItemId = useCallback((target: EventTarget | null): CultureListItemId | null => {
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
      element?.scrollIntoView?.({ block: 'nearest' });
      if (focusAfterSelect) {
        element?.focus?.({ preventScroll: true });
      }
    });
  }, [getId, onSelect]);

  const moveSelection = useCallback((key: string, focusedId: CultureListItemId | null | undefined): void => {
    if (items.length === 0) {
      return;
    }

    const selectedIndex = items.findIndex((item) => getId(item) === selectedId);
    const focusedIndex = items.findIndex((item) => getId(item) === focusedId);
    const currentIndex = selectedIndex >= 0 ? selectedIndex : focusedIndex;
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

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, focusedId: CultureListItemId | null | undefined): void => {
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

  const getItemProps = useCallback((item: TItem): CultureListItemProps => {
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

  const getListProps = useCallback((): CultureListProps => ({
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
