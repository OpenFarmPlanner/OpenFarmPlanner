/**
 * Tests for the culture/variety presentation in the planting-plan culture select.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CultureSelectOption,
  renderCultureSelectOption,
} from '../components/planting-plans/CultureSelectOption';
import { SearchableSelect, type SearchableSelectOption } from '../components/inputs/SearchableSelect';

const cultureOptions: SearchableSelectOption[] = [
  {
    value: 1,
    label: 'Salat · Lollo Bionda',
    data: { cultureName: 'Salat', variety: 'Lollo Bionda' },
  },
  {
    value: 2,
    label: 'Salat · Lollo Rossa',
    data: { cultureName: 'Salat', variety: 'Lollo Rossa' },
  },
  { value: 3, label: 'Karotte', data: { cultureName: 'Karotte', variety: '' } },
];

describe('CultureSelectOption', () => {
  it('shows the culture as the leading part and the variety as subordinate text', () => {
    render(<CultureSelectOption cultureName="Salat" variety="Lollo Bionda" />);

    expect(screen.getByText('Salat')).toBeInTheDocument();
    expect(screen.getByText('· Lollo Bionda')).toBeInTheDocument();
  });

  it('renders only the culture name when the entry has no variety', () => {
    render(<CultureSelectOption cultureName="Karotte" variety="" />);

    expect(screen.getByText('Karotte')).toBeInTheDocument();
    expect(screen.queryByText('·', { exact: false })).not.toBeInTheDocument();
  });
});

describe('culture select dropdown', () => {
  it('renders every variety of a culture underneath its own culture name', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        options={cultureOptions}
        value={null}
        onChange={vi.fn()}
        label="Kultur / Sorte"
        renderOption={(props, option) => {
          const { key, ...listProps } = props;
          return (
            <li {...listProps} key={key as number}>
              {renderCultureSelectOption(option)}
            </li>
          );
        }}
      />
    );

    await user.click(screen.getByRole('combobox'));

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Salat· Lollo Bionda');
    expect(options[1]).toHaveTextContent('Salat· Lollo Rossa');
    expect(options[2]).toHaveTextContent('Karotte');
  });

  it('keeps search, keyboard navigation and the selected label working on the combined label', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SearchableSelect
        options={cultureOptions}
        value={null}
        onChange={handleChange}
        label="Kultur / Sorte"
        renderOption={(props, option) => {
          const { key, ...listProps } = props;
          return (
            <li {...listProps} key={key as number}>
              {renderCultureSelectOption(option)}
            </li>
          );
        }}
      />
    );

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'Lollo R');

    expect(screen.getAllByRole('option')).toHaveLength(1);

    await user.keyboard('{Enter}');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: 2, label: 'Salat · Lollo Rossa' }),
    );
  });
});
