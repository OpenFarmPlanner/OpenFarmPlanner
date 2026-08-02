const SELECT_MENU_INTERNAL_CLOSE_TARGET_SELECTOR = [
  '[role="listbox"]',
  '[role="option"]',
  '[role="menuitem"]',
  '.MuiAutocomplete-popper',
  '.MuiMenu-paper',
  '.MuiPopover-paper',
].join(',');

const getUnknownEventTarget = (event: unknown): EventTarget | null => {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const target = (event as Record<string, unknown>).target;
  return target instanceof EventTarget ? target : null;
};

const getUnknownEventNativeEvent = (event: unknown): unknown => {
  if (!event || typeof event !== 'object') {
    return null;
  }

  return (event as Record<string, unknown>).nativeEvent ?? event;
};

const getUnknownEventKey = (event: unknown): string | null => {
  const readKey = (source: unknown): string | null => {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const key = (source as Record<string, unknown>).key;
    return typeof key === 'string' ? key : null;
  };

  return readKey(getUnknownEventNativeEvent(event)) ?? readKey(event);
};

const getUnknownEventPoint = (event: unknown): { clientX: number; clientY: number } | null => {
  const readPoint = (source: unknown): { clientX: number; clientY: number } | null => {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const record = source as Record<string, unknown>;
    if (typeof record.clientX === 'number' && typeof record.clientY === 'number') {
      return { clientX: record.clientX, clientY: record.clientY };
    }

    return null;
  };

  return readPoint(getUnknownEventNativeEvent(event)) ?? readPoint(event);
};

export const isSelectEditMenuInternalCloseTarget = (event: unknown): boolean => {
  const target = getUnknownEventTarget(event);
  return target instanceof Element && target.closest(SELECT_MENU_INTERNAL_CLOSE_TARGET_SELECTOR) !== null;
};

export const isSelectEditMenuEscapeClose = (event: unknown): boolean =>
  getUnknownEventKey(event) === 'Escape';

export const isSelectEditMenuCloseOutsideElement = (
  event: unknown,
  element: HTMLElement,
): boolean => {
  const target = getUnknownEventTarget(event);
  if (target instanceof Node && element.contains(target)) {
    return false;
  }

  const point = getUnknownEventPoint(event);
  if (!point) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    point.clientX < rect.left
    || point.clientX > rect.right
    || point.clientY < rect.top
    || point.clientY > rect.bottom
  );
};
