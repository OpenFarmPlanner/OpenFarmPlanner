import { useCallback, useLayoutEffect, useRef, type UIEvent } from 'react';

export interface PreservedScrollPosition<TElement extends HTMLElement> {
  /** Attach to the scrollable container; restores the stored offset on (re)mount. */
  scrollableRef: (element: TElement | null) => void;
  /** Attach to the same container's `onScroll` so user scrolling is recorded. */
  onScroll: (event: UIEvent<TElement>) => void;
}

/**
 * Keeps a scrollable container at the offset the user left it when the
 * container is remounted — e.g. because a refetch briefly swaps the list for a
 * loading state, or a branch above it re-renders. The offset is clamped to the
 * container's current scroll range, so a list that grew or shrank slightly
 * still lands as close to the previous position as it can.
 *
 * The restore runs from a layout effect (not from the ref callback) so it wins
 * over any `scrollIntoView` a hook declared earlier in the component performs
 * on the same commit; call this hook after those hooks.
 */
export function usePreservedScrollPosition<TElement extends HTMLElement>(): PreservedScrollPosition<TElement> {
  const scrollTopRef = useRef(0);
  const elementRef = useRef<TElement | null>(null);
  const restorePendingRef = useRef(false);

  const scrollableRef = useCallback((element: TElement | null): void => {
    elementRef.current = element;
    restorePendingRef.current = element !== null && scrollTopRef.current > 0;
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!restorePendingRef.current || !element) {
      return;
    }
    restorePendingRef.current = false;
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = Math.min(scrollTopRef.current, maxScrollTop);
  });

  const onScroll = useCallback((event: UIEvent<TElement>): void => {
    // A programmatic restore also fires onScroll; recording it is harmless
    // because it stores the value that was just restored.
    scrollTopRef.current = event.currentTarget.scrollTop;
  }, []);

  return { scrollableRef, onScroll };
}
