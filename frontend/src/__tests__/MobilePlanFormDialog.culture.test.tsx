/**
 * The mobile planting-plan form shows the same Kultur/Sorte split as the
 * desktop dropdown while its closed select keeps the plain combined label.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobilePlanFormDialog } from '../components/planting-plans/MobilePlanFormDialog';
import type { SearchableSelectOption } from '../components/data-grid';
import { createEmptyMobileCreateForm } from '../pages/plantingPlansUtils';

const cultureOptions: SearchableSelectOption[] = [
  {
    value: 1,
    label: 'Salat · Lollo Bionda',
    data: { cultureName: 'Salat', variety: 'Lollo Bionda' },
  },
  { value: 2, label: 'Karotte', data: { cultureName: 'Karotte', variety: '' } },
];

const renderDialog = (culture: string) => render(
  <MobilePlanFormDialog
    open
    isEdit={false}
    form={{ ...createEmptyMobileCreateForm(), culture }}
    setForm={vi.fn()}
    error=""
    cultureOptions={cultureOptions}
    bedOptions={[]}
    cultivationTypeOptions={[]}
    numberLocale="de-DE"
    getPlantsPerSqm={() => null}
    onLinkedFieldEdited={vi.fn()}
    onClose={vi.fn()}
    onSubmit={vi.fn()}
  />,
);

describe('MobilePlanFormDialog culture select', () => {
  it('labels the culture field with the combined Kultur / Sorte header', () => {
    renderDialog('');

    expect(screen.getAllByText('Kultur / Sorte').length).toBeGreaterThan(0);
  });

  it('shows the variety as subordinate text in the open dropdown', async () => {
    const user = userEvent.setup();
    renderDialog('');

    await user.click(screen.getAllByRole('combobox')[0]);

    const options = screen.getAllByRole('option');
    expect(within(options[0]).getByText('Salat')).toBeInTheDocument();
    expect(within(options[0]).getByText('· Lollo Bionda')).toBeInTheDocument();
    expect(options[1]).toHaveTextContent('Karotte');
  });

  it('keeps the selected value readable as culture and variety in the closed select', () => {
    renderDialog('1');

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Salat · Lollo Bionda');
  });
});
