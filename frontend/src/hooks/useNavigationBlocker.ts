/**
 * Hook for blocking navigation when there are unsaved changes.
 * 
 * Uses React Router's blocker API to prevent route changes
 * when there are unsaved changes that would be lost.
 * Also handles browser navigation via beforeunload.
 * 
 * @param shouldBlock Whether navigation should be blocked
 * @param message Optional custom message for the confirmation dialog
 * 
 * @remarks
 * Used in conjunction with useAutosaveDraft to prevent data loss.
 * Shows a confirmation dialog when user tries to navigate away.
 * Works with data routers (createBrowserRouter).
 */

import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { confirmAction } from '../utils/confirmAction';

/**
 * Hook to block navigation when there are unsaved changes
 *
 * @param onProceed Optional callback run after the user confirms leaving,
 * before navigation actually proceeds, e.g. to save in-progress edits
 * instead of silently discarding them (the confirmation message tells the
 * user their changes will be saved, so this makes that true).
 */
export function useNavigationBlocker(
  shouldBlock: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?',
  onProceed?: () => Promise<void> | void,
  confirmBeforeProceed = true,
): void {
  // Setup beforeunload handler for browser navigation (tab close, reload, etc.)
  useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but setting returnValue triggers the dialog
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldBlock, message]);

  // Use React Router's blocker for in-app navigation
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    // Only block if we're actually navigating to a different location
    return shouldBlock && currentLocation.pathname !== nextLocation.pathname;
  });

  // Handle blocker state. `blocker` is a fresh object every render (its
  // `.state` just happens to still read 'blocked'), and onProceed (e.g.
  // saving dirty rows) triggers several of those re-renders itself while
  // it's in flight. Without this guard each one re-runs the effect and
  // re-shows the confirm dialog for what is still the same blocked
  // transition. Reset once the router has moved past 'blocked'.
  const isHandlingBlockRef = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked') {
      isHandlingBlockRef.current = false;
      return;
    }
    if (isHandlingBlockRef.current) {
      return;
    }
    isHandlingBlockRef.current = true;

    const proceed = confirmBeforeProceed ? confirmAction(message) : true;
    if (proceed) {
      if (onProceed) {
        // Proceed regardless of whether the save succeeds. A failed
        // save shouldn't trap the user on the page; validation errors
        // remain visible inline for when they come back to the row.
        void Promise.resolve(onProceed()).catch(() => undefined).finally(() => blocker.proceed());
      } else {
        blocker.proceed();
        isHandlingBlockRef.current = false;
      }
    } else {
      blocker.reset();
      isHandlingBlockRef.current = false;
    }
  }, [blocker, confirmBeforeProceed, message, onProceed]);
}
