/**
 * Guards the recovery path for a lazy route chunk that fails to load: the app
 * reloads itself exactly once, and the retry marker survives that reload so a
 * still-broken chunk lands on the fallback instead of reloading in a loop.
 */
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import i18n from '../i18n/config';

const reloadPage = vi.hoisted(() => vi.fn());

// Vitest wraps a module factory error, so the page failure is classified via a
// stubbed detector instead; the detector itself is covered by
// `chunkLoadErrors.test.ts`.
vi.mock('../runtime/chunkLoadErrors', async () => {
  const actual = await vi.importActual<typeof import('../runtime/chunkLoadErrors')>(
    '../runtime/chunkLoadErrors',
  );
  return { ...actual, reloadPage, isDynamicImportLoadError: () => true };
});

// Rejects asynchronously so the route suspends first, matching how a real
// chunk request fails after the surrounding layout has already rendered.
vi.mock('../pages/public/ImprintPage', async () => {
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  throw new Error('chunk unavailable');
});

const RETRY_STORAGE_KEY = 'openFarmPlanner.routeLoadRetry./impressum';

function renderApp() {
  return render(
    <StrictMode>
      <FocusManagerProvider>
        <CommandProvider>
          <App />
        </CommandProvider>
      </FocusManagerProvider>
    </StrictMode>,
  );
}

describe('lazy route chunk recovery', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    sessionStorage.clear();
    reloadPage.mockClear();
    window.history.pushState({}, '', '/impressum');
  });

  it('reloads once and keeps the retry marker for the failed route', async () => {
    renderApp();

    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    // The root layout must not clear the marker while the route is still broken,
    // otherwise the next load gets a fresh retry budget and reloads again.
    await waitFor(() => expect(sessionStorage.getItem(RETRY_STORAGE_KEY)).not.toBeNull());
  });

  it('falls back to the manual reload action when the retry is already spent', async () => {
    sessionStorage.setItem(RETRY_STORAGE_KEY, String(Date.now()));

    renderApp();

    expect(await screen.findByRole('button', { name: 'Seite neu laden' })).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
