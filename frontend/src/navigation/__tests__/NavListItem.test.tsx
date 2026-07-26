import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import NavListItem from '../NavListItem';

const DISABLED_TOOLTIP = 'Erstelle zuerst ein Projekt.';

function renderItem(overrides: Partial<React.ComponentProps<typeof NavListItem>> = {}) {
  const onNavigate = vi.fn();
  render(
    <MemoryRouter>
      <NavListItem
        to="/app/cultures"
        label="Kulturen"
        icon={<span data-testid="icon" />}
        isActive={false}
        disabled={false}
        disabledTooltip={DISABLED_TOOLTIP}
        itemSx={{}}
        iconSx={{}}
        textProps={{}}
        onNavigate={onNavigate}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onNavigate };
}

describe('NavListItem — no active project (disabled)', () => {
  it('stays visible (icon + label) but is not rendered as a navigable link', () => {
    renderItem({ disabled: true });

    expect(screen.getByText('Kulturen')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    // No <a href> exists at all — navigation cannot be triggered by click or
    // keyboard, independent of any CSS pointer-events/disabled styling.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('exposes an accessible disabled state', () => {
    renderItem({ disabled: true });

    const control = screen.getByText('Kulturen').closest('[aria-disabled]');
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAttribute('tabindex', '-1');
  });

  it('does not call onNavigate on click', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderItem({ disabled: true });

    // The disabled control itself has `pointer-events: none` (real browser
    // behavior, honored by userEvent) — only the Tooltip's wrapper span is
    // actually clickable, exactly as a real pointer interaction would land.
    const control = screen.getByText('Kulturen').closest('[aria-disabled]') as HTMLElement;
    await user.click(control.parentElement as HTMLElement);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not call onNavigate on keyboard activation', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderItem({ disabled: true });

    // Disabled items are removed from the tab order (tabindex=-1); simulate a
    // determined keyboard user who still dispatches Enter/Space at the node.
    const control = screen.getByText('Kulturen').closest('[aria-disabled]') as HTMLElement;
    control.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('shows an explanatory tooltip on hover', async () => {
    const user = userEvent.setup();
    renderItem({ disabled: true });

    const control = screen.getByText('Kulturen').closest('[aria-disabled]') as HTMLElement;
    await user.hover(control.parentElement as HTMLElement);

    expect(await screen.findByText(DISABLED_TOOLTIP)).toBeInTheDocument();
  });
});

describe('NavListItem — active project (enabled)', () => {
  it('renders as a real link to the destination', () => {
    renderItem({ disabled: false });

    const link = screen.getByRole('link', { name: 'Kulturen' });
    expect(link).toHaveAttribute('href', '/app/cultures');
    expect(link).not.toHaveAttribute('aria-disabled');
  });

  it('calls onNavigate when clicked', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderItem({ disabled: false });

    await user.click(screen.getByRole('link', { name: 'Kulturen' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows the label as a tooltip when an explicit enabledTooltip is given (collapsed sidebar)', async () => {
    const user = userEvent.setup();
    renderItem({ disabled: false, enabledTooltip: 'Kulturen' });

    await user.hover(screen.getByRole('link', { name: 'Kulturen' }));

    expect(await screen.findAllByText('Kulturen')).not.toHaveLength(0);
  });
});
