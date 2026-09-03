import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItem } from '@mui/material';

import { FilterSelectField } from '../components/filters/FilterSelectField';

const renderField = (props: { value?: string; onChange?: () => void } = {}) => render(
  <FilterSelectField
    id="crop-family-filter"
    label="Kulturfamilie"
    value={props.value ?? ''}
    onChange={props.onChange ?? (() => {})}
  >
    <MenuItem value="">Alle</MenuItem>
    <MenuItem value="brassica">Brassica</MenuItem>
  </FilterSelectField>,
);

describe('FilterSelectField', () => {
  it('labels the select so it can be found by its visible label', () => {
    renderField();

    expect(screen.getByLabelText('Kulturfamilie')).toBeInTheDocument();
  });

  it('derives the label element id from the field id', () => {
    const { container } = renderField();

    expect(container.querySelector('#crop-family-filter-label')).toHaveTextContent('Kulturfamilie');
  });

  it('shows the selected option', () => {
    renderField({ value: 'brassica' });

    expect(screen.getByLabelText('Kulturfamilie')).toHaveTextContent('Brassica');
  });

  it('reports the picked option to onChange', async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    await userEvent.click(screen.getByLabelText('Kulturfamilie'));
    await userEvent.click(screen.getByRole('option', { name: 'Brassica' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'brassica' }) }),
      expect.anything(),
    );
  });
});
