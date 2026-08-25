import { useEffect, useLayoutEffect, useState } from 'react';
import type { TooltipProps } from '@mui/material';
import { AppTooltip } from './AppTooltip';

const FLOATING_DROPDOWN_SELECTOR = [
  '.MuiPopover-root [role="listbox"]',
  '.MuiPopover-root [role="menu"]',
  '.MuiMenu-paper [role="listbox"]',
  '.MuiMenu-paper [role="menu"]',
  '.MuiAutocomplete-popper [role="listbox"]',
  '.MuiPopper-root [role="listbox"]',
  '.MuiPopper-root [role="menu"]',
].join(',');

const hasFloatingDropdown = (): boolean => (
  Boolean(document.querySelector(FLOATING_DROPDOWN_SELECTOR))
);

const isDropdownTrigger = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement
  && Boolean(target.closest('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'))
);

function useFloatingDropdownOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateOpenState = (): void => {
      setOpen(hasFloatingDropdown());
    };

    updateOpenState();

    const observer = new MutationObserver(updateOpenState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'class', 'aria-hidden'],
    });

    document.addEventListener('focusin', updateOpenState);
    document.addEventListener('mousedown', updateOpenState);
    document.addEventListener('keydown', updateOpenState);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', updateOpenState);
      document.removeEventListener('mousedown', updateOpenState);
      document.removeEventListener('keydown', updateOpenState);
    };
  }, []);

  return open;
}

function useDropdownInteractionSuppressed(): boolean {
  const [triggerSuppressed, setTriggerSuppressed] = useState(false);

  useLayoutEffect(() => {
    const suppressForDropdownTrigger = (event: Event): void => {
      if (isDropdownTrigger(event.target)) {
        setTriggerSuppressed(true);
        return;
      }

      setTriggerSuppressed(false);
    };
    const clearSuppressionAwayFromDropdownTrigger = (event: Event): void => {
      if (!isDropdownTrigger(event.target)) {
        setTriggerSuppressed(false);
      }
    };

    document.addEventListener('mousedown', suppressForDropdownTrigger, true);
    document.addEventListener('mouseover', clearSuppressionAwayFromDropdownTrigger, true);
    document.addEventListener('focusin', suppressForDropdownTrigger, true);
    document.addEventListener('keydown', suppressForDropdownTrigger, true);

    return () => {
      document.removeEventListener('mousedown', suppressForDropdownTrigger, true);
      document.removeEventListener('mouseover', clearSuppressionAwayFromDropdownTrigger, true);
      document.removeEventListener('focusin', suppressForDropdownTrigger, true);
      document.removeEventListener('keydown', suppressForDropdownTrigger, true);
    };
  }, []);

  return triggerSuppressed;
}

export function DropdownAwareTooltip({
  open,
  onOpen,
  onClose,
  disableHoverListener,
  disableFocusListener,
  disableTouchListener,
  ...props
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dropdownOpen = useFloatingDropdownOpen();
  const dropdownInteractionSuppressed = useDropdownInteractionSuppressed();
  const shouldHideTooltip = dropdownOpen || dropdownInteractionSuppressed;
  const effectiveOpen = shouldHideTooltip ? false : (open ?? uncontrolledOpen);

  return (
    <AppTooltip
      {...props}
      open={effectiveOpen}
      onOpen={(event) => {
        if (dropdownOpen || (dropdownInteractionSuppressed && isDropdownTrigger(event.currentTarget))) {
          return;
        }
        setUncontrolledOpen(true);
        onOpen?.(event);
      }}
      onClose={(event) => {
        setUncontrolledOpen(false);
        onClose?.(event);
      }}
      disableHoverListener={dropdownOpen || disableHoverListener}
      disableFocusListener={shouldHideTooltip || disableFocusListener}
      disableTouchListener={shouldHideTooltip || disableTouchListener}
    />
  );
}
