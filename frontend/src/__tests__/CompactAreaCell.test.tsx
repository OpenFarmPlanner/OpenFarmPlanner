import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactAreaCell } from '../components/planting-plans/CompactAreaCell';
import { shouldShowAreaTooltip } from '../components/planting-plans/compactAreaCellUtils';

describe('CompactAreaCell', () => {
  it('shows tooltip with full text on hover for long values', async () => {
    const user = userEvent.setup();
    const label = 'Regenbogenland · 8 Karotte + Zwiebel · Beet 5 (10,00 m²)';

    render(<CompactAreaCell label={label} />);

    await user.hover(screen.getByText(label));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
  });

  it('is keyboard focusable with full accessible text when the grid cell has focus', async () => {
    const label = 'Regenbogenland · 8 Karotte + Zwiebel · Beet 5 (10,00 m²)';

    render(<CompactAreaCell label={label} hasFocus />);

    const focusTarget = screen.getByLabelText(label);
    expect(focusTarget).toHaveAttribute('tabindex', '0');
    await waitFor(() => expect(focusTarget).toHaveFocus());
  });

  it('stays out of the tab order when the grid cell does not have focus', () => {
    const label = 'Regenbogenland · 8 Karotte + Zwiebel · Beet 5 (10,00 m²)';

    render(<CompactAreaCell label={label} />);

    expect(screen.getByLabelText(label)).toHaveAttribute('tabindex', '-1');
  });

  it('keeps short values compact without tooltip interaction', async () => {
    const user = userEvent.setup();
    const label = 'Parzelle · Beet';

    render(<CompactAreaCell label={label} />);

    await user.hover(screen.getByText(label));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses compact ellipsis styles', () => {
    const label = 'Regenbogenland · 8 Karotte + Zwiebel · Beet 5 (10,00 m²)';
    const { container } = render(<CompactAreaCell label={label} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle({ overflow: 'hidden' });
  });

  it('decides tooltip visibility only when value is long or overflowing', () => {
    expect(shouldShowAreaTooltip('kurz', false)).toBe(false);
    expect(shouldShowAreaTooltip('x'.repeat(45), false)).toBe(true);
    expect(shouldShowAreaTooltip('kurz', true)).toBe(true);
  });
});
