/**
 * Custom hook for keyboard navigation between main views.
 *
 * Provides Ctrl+Shift+ArrowDown and Ctrl+Shift+ArrowUp shortcuts to cycle through
 * the main application routes in a circular manner.
 * These shortcuts don't conflict with browser navigation or tab switching.
 * Shortcuts are disabled when focus is on input or textarea elements.
 *
 * @returns void
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getKeyboardNavigationRouteFromPathname, ORDERED_APP_ROUTES } from '../navigation/mainNavigation';

export function useKeyboardNavigation(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathnameRef = useRef(location.pathname);

  useEffect(() => {
    currentPathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isNavigationShortcut =
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp');

      if (!isNavigationShortcut) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement && 'contentEditable' in activeElement && activeElement.contentEditable === 'true')
      ) {
        return;
      }

      event.preventDefault();

      const currentRoute = getKeyboardNavigationRouteFromPathname(currentPathnameRef.current);
      const currentIndex = currentRoute ? ORDERED_APP_ROUTES.indexOf(currentRoute) : -1;
      if (currentIndex === -1) {
        console.warn(`[keyboard-nav] Unknown route for pathname "${currentPathnameRef.current}". Falling back to dashboard.`);
        navigate('/app/dashboard');
        return;
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + ORDERED_APP_ROUTES.length) % ORDERED_APP_ROUTES.length;

      navigate(ORDERED_APP_ROUTES[nextIndex]);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);
}
