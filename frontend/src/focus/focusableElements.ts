const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

const isVisible = (element: Element): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

/** Elements the browser skips even though they match the selector above: MUI
 * renders a hidden `<input tabindex="-1" aria-hidden>` next to every Select,
 * and roving-tabindex widgets park `tabindex="-1"` on their inactive items.
 * Content-editable hosts are checked by attribute — jsdom does not implement
 * contenteditable, so their `tabIndex` reads as -1 in tests. */
const isTabbable = (element: HTMLElement): boolean => (
  (element.tabIndex >= 0 || element.getAttribute('contenteditable') === 'true')
  && element.getAttribute('aria-hidden') !== 'true'
);

/** Focusable descendants of `container`, in DOM (reading) order. Used both
 * to find the first element an `F6`-focused region should land on, and to
 * compute the Tab-wrap boundaries for that region. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => isVisible(element) && isTabbable(element));
}

export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  return getFocusableElements(container)[0] ?? null;
}

interface TabbableNeighbourOptions {
  /** Close the cycle at the container's edges, the way a modal focus trap
   * does. Off for containers Tab is allowed to leave (e.g. a page form). */
  wrap?: boolean;
}

/** Where Tab (`direction: 1`) or Shift+Tab (`direction: -1`) would land when
 * starting from `origin`, without leaving `container`. Returns `null` when the
 * move would leave the container and `wrap` is off. */
export function getTabbableNeighbour(
  container: HTMLElement,
  origin: HTMLElement,
  direction: 1 | -1,
  { wrap = false }: TabbableNeighbourOptions = {},
): HTMLElement | null {
  const tabbable = getFocusableElements(container);
  const currentIndex = tabbable.indexOf(origin);
  if (currentIndex === -1) {
    return null;
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < tabbable.length) {
    return tabbable[nextIndex];
  }
  if (!wrap) {
    return null;
  }

  return direction === 1 ? tabbable[0] : tabbable[tabbable.length - 1];
}
