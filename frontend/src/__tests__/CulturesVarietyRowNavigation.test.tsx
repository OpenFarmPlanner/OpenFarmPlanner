import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
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

vi.mock('../cultures/CultureForm', () => ({
  CultureForm: (): ReactElement => <div data-testid="culture-form" />,
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

function NavigationObserver(): ReactElement {
  const navigationType = useNavigationType();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="nav-type">{navigationType}</span>
      <span data-testid="nav-search">{location.search}</span>
      <button type="button" onClick={() => navigate(-1)}>go-back</button>
    </div>
  );
}

function renderCultures(initialEntry: string): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavigationObserver />
      <FocusManagerProvider><CommandProvider><Cultures /></CommandProvider></FocusManagerProvider>
    </MemoryRouter>
  );
}

describe('Varieties table row navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    listMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Carrot', variety: '', growth_duration_days: 1, harvest_duration_days: 1 },
          {
            id: 2, name: 'Carrot', variety: 'Nantaise', growth_duration_days: 1, harvest_duration_days: 1,
            row_spacing_cm: 30,
          },
        ],
      },
    });
  });

  it('pushes a new history entry when navigating to a variety via a table row click', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByText('Nantaise').closest('.variety-row') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByTestId('nav-search')).toHaveTextContent('cultureId=2');
    });
    expect(screen.getByTestId('nav-type')).toHaveTextContent('PUSH');
  });

  it('returns to the crop page when going back after a table row click (real back-button behavior)', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByText('Nantaise').closest('.variety-row') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByTestId('nav-search')).toHaveTextContent('cultureId=2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'go-back' }));

    await waitFor(() => {
      expect(screen.getByTestId('nav-search')).toHaveTextContent('cultureId=1');
    });
  });
});
