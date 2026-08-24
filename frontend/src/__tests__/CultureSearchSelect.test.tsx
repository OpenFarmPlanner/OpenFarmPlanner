import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CultureSearchSelect } from '../cultures/CultureSearchSelect';
import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';
import type { Culture } from '../api/types';
import translations from '@/test-utils/translations';

const GENERAL_CROP_LABEL = translations.cultures.hierarchy.generalCrop;
const SEARCH_LABEL = 'Kultur suchen';

const pfefferoni: Culture = { id: 1, name: 'Pfefferoni', crop_species: 10, variety: '' };
const milderSpiral: Culture = { id: 2, name: 'Pfefferoni', crop_species: 10, variety: 'Milder Spiral' };
const scharferSpiral: Culture = { id: 3, name: 'Pfefferoni', crop_species: 10, variety: 'Scharfer Spiral' };
const tomate: Culture = { id: 4, name: 'Tomate', crop_species: 20, variety: '' };

function toOption(culture: Culture): SearchableSelectOption<Culture> {
  return {
    value: culture.id!,
    label: culture.variety ? `${culture.name} – ${culture.variety}` : culture.name,
    data: culture,
  };
}

function renderSelect(
  cultures: Culture[],
  onChange = vi.fn<[SearchableSelectOption<Culture> | null], void>(),
) {
  render(
    <CultureSearchSelect
      options={cultures.map(toOption)}
      value={null}
      onChange={onChange}
      label={SEARCH_LABEL}
    />,
  );
  return onChange;
}

describe('CultureSearchSelect', () => {
  it('groups varieties under a selectable Kultur header', async () => {
    const user = userEvent.setup();
    renderSelect([pfefferoni, milderSpiral, scharferSpiral, tomate]);

    await user.click(screen.getByLabelText(SEARCH_LABEL));

    const pfefferoniGroup = screen.getByRole('group', { name: 'Pfefferoni' });
    const groupOptions = within(pfefferoniGroup).getAllByRole('option');
    expect(groupOptions.map((option) => option.getAttribute('aria-label'))).toEqual([
      `Pfefferoni – ${GENERAL_CROP_LABEL}`,
      'Pfefferoni – Milder Spiral',
      'Pfefferoni – Scharfer Spiral',
    ]);
    // The header names the Kultur, so the rows below it show the Sorte alone.
    expect(within(groupOptions[1]).getByText('Milder Spiral')).toBeInTheDocument();
    expect(within(groupOptions[1]).queryByText(/Pfefferoni/)).not.toBeInTheDocument();
    expect(within(groupOptions[0]).getByText(GENERAL_CROP_LABEL)).toBeInTheDocument();
  });

  it('renders the group header for a Kultur without any varieties', async () => {
    const user = userEvent.setup();
    renderSelect([tomate]);

    await user.click(screen.getByLabelText(SEARCH_LABEL));

    const tomateGroup = screen.getByRole('group', { name: 'Tomate' });
    expect(within(tomateGroup).getAllByRole('option')).toHaveLength(1);
    expect(
      screen.getByRole('option', { name: `Tomate – ${GENERAL_CROP_LABEL}` }),
    ).toBeInTheDocument();
  });

  it('keeps the Kultur header when only a variety is in the result list', async () => {
    const user = userEvent.setup();
    // What the page passes down when the query matched the Sorte name only.
    renderSelect([pfefferoni, milderSpiral]);

    await user.click(screen.getByLabelText(SEARCH_LABEL));

    const pfefferoniGroup = screen.getByRole('group', { name: 'Pfefferoni' });
    expect(within(pfefferoniGroup).getAllByRole('option')).toHaveLength(2);
  });

  it('selects the general Kultur when its header is clicked', async () => {
    const user = userEvent.setup();
    const onChange = renderSelect([pfefferoni, milderSpiral]);

    await user.click(screen.getByLabelText(SEARCH_LABEL));
    await user.click(screen.getByRole('option', { name: `Pfefferoni – ${GENERAL_CROP_LABEL}` }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: pfefferoni.id }));
  });

  it('walks headers and varieties in one arrow-key sequence and selects on Enter', async () => {
    const user = userEvent.setup();
    const onChange = renderSelect([pfefferoni, milderSpiral, scharferSpiral]);

    const input = screen.getByLabelText(SEARCH_LABEL);
    await user.click(input);
    // Down from the header goes to the first Sorte, not past the whole group.
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: milderSpiral.id }));
  });

  it('selects the general Kultur with Enter on a keyboard-focused header', async () => {
    const user = userEvent.setup();
    const onChange = renderSelect([pfefferoni, milderSpiral]);

    const input = screen.getByLabelText(SEARCH_LABEL);
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: pfefferoni.id }));
  });
});
