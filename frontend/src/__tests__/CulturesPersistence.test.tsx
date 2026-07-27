import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';

const {
  formCultureIdHistory,
  listMock,
  selectedIdHistory,
} = vi.hoisted(() => ({
  formCultureIdHistory: [] as Array<number | undefined>,
  listMock: vi.fn(),
  selectedIdHistory: [] as Array<number | undefined>,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({ selectedCultureId, onCultureSelect }: {
    selectedCultureId?: number;
    onCultureSelect: (culture: { id?: number } | null) => void;
  }): ReactElement => {
    selectedIdHistory.push(selectedCultureId);

    return (
      <div>
        <span data-testid="selected-culture-id">{selectedCultureId ?? 'none'}</span>
        <button type="button" onClick={() => onCultureSelect({ id: 2 })}>
          select-culture-2
        </button>
      </div>
    );
  },
}));

vi.mock('../cultures/CultureForm', () => ({
  CultureForm: ({ culture }: { culture?: { id?: number } }): ReactElement => {
    formCultureIdHistory.push(culture?.id);

    return <div data-testid="culture-form">culture-form-{culture?.id ?? 'new'}</div>;
  },
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'tester@example.com', display_name: 'Tester' },
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

function SearchIndicator(): ReactElement {
  const location = useLocation();
  return <span data-testid="location-search">{location.search}</span>;
}

function renderCultures(initialEntry = '/cultures'): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/cultures"
          element={(
            <>
              <SearchIndicator />
              <FocusManagerProvider><CommandProvider><Cultures /></CommandProvider></FocusManagerProvider>
            </>
          )}
        />
        <Route path="/locations" element={<div data-testid="locations-page">locations</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function CrossRouteHarness(): ReactElement {
  return (
    <>
      <Link to="/locations">go-locations</Link>
      <SearchIndicator />
      <FocusManagerProvider><CommandProvider><Cultures /></CommandProvider></FocusManagerProvider>
    </>
  );
}

describe('Cultures selection persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formCultureIdHistory.length = 0;
    selectedIdHistory.length = 0;
    localStorage.clear();

    listMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1 },
          { id: 2, name: 'Kartoffel', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });
  });

  it('restores initial selection from query parameter once', async () => {
    localStorage.setItem('selectedCultureId', '2');

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    }, { timeout: 3000 });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=1');
    expect(localStorage.getItem('selectedCultureId')).toBe('1');
    expect(selectedIdHistory).not.toContain(undefined);
  });

  it('opens edit dialog from explicit url action and removes only the action parameter', async () => {
    renderCultures('/cultures?cultureId=1&action=edit');

    await waitFor(() => {
      expect(screen.getByTestId('culture-form')).toHaveTextContent('culture-form-1');
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=1');
    }, { timeout: 3000 });

    expect(formCultureIdHistory[0]).toBe(1);
  });

  it('persists user selection to url and localStorage', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'select-culture-2' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    }, { timeout: 3000 });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=2');
    expect(localStorage.getItem('selectedCultureId')).toBe('2');
  });

  it('restores selection from localStorage when returning without query parameter', async () => {
    localStorage.setItem('selectedCultureId', '2');

    renderCultures('/cultures');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    }, { timeout: 3000 });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=2');
    expect(localStorage.getItem('selectedCultureId')).toBe('2');
  });

  it('does not flip back to previous selection after user change', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'select-culture-2' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    }, { timeout: 3000 });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstSelectionOfTwo = selectedIdHistory.findIndex((value) => value === 2);
    const valuesAfterSelectingTwo = selectedIdHistory.slice(firstSelectionOfTwo);

    expect(firstSelectionOfTwo).toBeGreaterThan(-1);
    expect(valuesAfterSelectingTwo).not.toContain(1);
  });

  it('does not navigate back to cultures after leaving the route', async () => {
    render(
      <MemoryRouter initialEntries={['/cultures?cultureId=1']}>
        <Routes>
          <Route path="/cultures" element={<CrossRouteHarness />} />
          <Route path="/locations" element={<div data-testid="locations-page">locations</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('link', { name: 'go-locations' }));

    await waitFor(() => {
      expect(screen.getByTestId('locations-page')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByTestId('selected-culture-id')).not.toBeInTheDocument();
  });
});
