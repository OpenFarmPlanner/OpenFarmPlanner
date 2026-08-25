import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditIcon from '@mui/icons-material/Edit';
import { DetailPageActions } from '../components/layout/DetailPageActions';

describe('DetailPageActions', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
  });

  // The label is dropped by CSS below the `lg` breakpoint, so the media query
  // is what tells the component whether the button is currently icon-only.
  function mockLabelsCollapsed(collapsed: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: collapsed && query.includes('max-width:1199.95px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  const renderActions = (overrides: Partial<Parameters<typeof DetailPageActions>[0]> = {}) =>
    render(
      <DetailPageActions
        primaryActions={[
          { label: 'Bearbeiten', icon: <EditIcon fontSize="small" />, onClick: vi.fn() },
        ]}
        {...overrides}
      />,
    );

  it('explains an icon-only button with its own label as the tooltip', async () => {
    mockLabelsCollapsed(true);
    const user = userEvent.setup();
    renderActions();

    await user.hover(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Bearbeiten');
  });

  it('does not add a tooltip once the label itself is on screen', async () => {
    mockLabelsCollapsed(false);
    const user = userEvent.setup();
    renderActions();

    await user.hover(screen.getByRole('button', { name: 'Bearbeiten' }));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('keeps an explicit tooltip (e.g. a disabled reason) when the label is collapsed', async () => {
    mockLabelsCollapsed(true);
    const user = userEvent.setup();
    renderActions({
      primaryActions: [{
        label: 'Anbauplan hinzufügen',
        icon: <EditIcon fontSize="small" />,
        onClick: vi.fn(),
        disabled: true,
        tooltip: 'Lege zuerst ein Beet an.',
      }],
    });

    // A disabled button swallows pointer events, which is exactly why the
    // tooltip is anchored on the wrapping span rather than the button itself.
    const wrapper = screen.getByRole('button', { name: 'Anbauplan hinzufügen' }).parentElement;
    await user.hover(wrapper as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Lege zuerst ein Beet an.');
  });

  it('always renders the labels so they can be revealed by CSS alone, without a re-render', () => {
    mockLabelsCollapsed(true);
    renderActions();

    expect(screen.getByTestId('detail-page-action-label')).toHaveTextContent('Bearbeiten');
  });
});
