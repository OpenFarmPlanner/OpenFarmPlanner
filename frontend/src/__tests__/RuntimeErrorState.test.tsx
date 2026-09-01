import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RuntimeErrorState from '../components/runtime/RuntimeErrorState';

const reloadForManualRecovery = vi.hoisted(() => vi.fn());

vi.mock('../runtime/chunkLoadErrors', async () => {
  const actual = await vi.importActual<typeof import('../runtime/chunkLoadErrors')>(
    '../runtime/chunkLoadErrors',
  );
  return { ...actual, reloadForManualRecovery };
});

describe('RuntimeErrorState', () => {
  beforeEach(() => {
    reloadForManualRecovery.mockClear();
  });

  it('shows the route fallback with a manual reload action', () => {
    render(<RuntimeErrorState variant="routeError" />);

    expect(screen.getByText('Die Seite konnte nicht automatisch wiederhergestellt werden. Bitte lade die Seite neu.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seite neu laden' })).toBeInTheDocument();
  });

  it('shows the application update fallback with a manual reload action', () => {
    render(<RuntimeErrorState variant="applicationUpdated" />);

    expect(screen.getByText('Die Anwendung konnte nicht automatisch aktualisiert werden. Bitte lade die Seite neu.')).toBeInTheDocument();
  });

  it('triggers the manual recovery reload when the action is used', () => {
    render(<RuntimeErrorState variant="applicationUpdated" />);

    fireEvent.click(screen.getByRole('button', { name: 'Seite neu laden' }));

    expect(reloadForManualRecovery).toHaveBeenCalledTimes(1);
  });
});
