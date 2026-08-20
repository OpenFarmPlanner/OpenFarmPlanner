import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { cultureDuplicateCheckMock, publicCultureListMock, supplierListMock } = vi.hoisted(() => ({
  cultureDuplicateCheckMock: vi.fn().mockResolvedValue({ data: { exists: false } }),
  publicCultureListMock: vi.fn().mockResolvedValue({ data: { results: [] } }),
  supplierListMock: vi.fn().mockResolvedValue({ data: { results: [] } }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      duplicateCheck: cultureDuplicateCheckMock,
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureListMock,
    },
    supplierAPI: {
      list: supplierListMock,
    },
  };
});

const SPECIES_CULTURE: Culture = {
  id: 1,
  name: 'Karotte',
  variety: '',
  crop_family: 'Doldenblütler',
  nutrient_demand: 'medium',
  row_spacing_cm: 30,
};

// A species-linked pair: the general Kultur plus a Sorte that overrides nothing,
// so the API reports every value as resolved from the Kultur
// (see CultureSerializer.effective_values).
const LINKED_SPECIES_CULTURE: Culture = {
  id: 3,
  name: 'Pastinake',
  variety: '',
  crop_species: 7,
  crop_family: 'Doldenblütler',
  nutrient_demand: 'medium',
  row_spacing_cm: 30,
};

const INHERITING_VARIETY_CULTURE: Culture = {
  id: 4,
  name: 'Pastinake',
  variety: 'Halblange',
  crop_species: 7,
  general_culture: LINKED_SPECIES_CULTURE.id,
  inherited_fields: ['crop_family', 'nutrient_demand', 'row_spacing_cm'],
  effective_values: {
    crop_family: 'Doldenblütler',
    nutrient_demand: 'medium',
    row_spacing_cm: 30,
  },
};

const VARIETY_CULTURE: Culture = {
  id: 2,
  name: 'Karotte',
  variety: 'Nantaise',
  crop_family: 'Sonderfamilie',
  nutrient_demand: 'medium',
  row_spacing_cm: 40,
};

describe('CultureForm variety override highlighting', () => {
  beforeEach(() => {
    cultureDuplicateCheckMock.mockClear();
    publicCultureListMock.mockClear();
    supplierListMock.mockClear();
    supplierListMock.mockResolvedValue({ data: { results: [] } });
  });

  it('shows the legend and highlights only fields that override the species culture', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <CultureForm
        culture={VARIETY_CULTURE}
        cultures={[SPECIES_CULTURE, VARIETY_CULTURE]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    expect(screen.getByText('hierarchy.ownValueLegendSample')).toBeInTheDocument();

    const cropFamilyField = screen.getByLabelText('form.cropFamily');
    const rowSpacingField = screen.getByLabelText('form.rowSpacingCm');
    const nutrientDemandLabel = screen.getAllByText('form.nutrientDemand').find((el) => el.tagName === 'LABEL');
    const nutrientDemandFormControl = nutrientDemandLabel?.closest('.MuiFormControl-root');
    if (!nutrientDemandFormControl) {
      throw new Error('nutrient demand FormControl not found');
    }
    const nutrientDemandField = within(nutrientDemandFormControl as HTMLElement).getByRole('combobox');

    // Reset DropdownAwareTooltip's suppression state: mounting the dialog
    // auto-focuses the (combobox-like) name field, which otherwise keeps
    // every tooltip suppressed for the rest of the test.
    await user.click(cropFamilyField);

    await user.hover(cropFamilyField);
    expect(await screen.findByRole('tooltip', {}, { timeout: 5000 })).toHaveTextContent('hierarchy.ownValueFieldTooltip');
    await user.unhover(cropFamilyField);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(), { timeout: 5000 });

    await user.hover(rowSpacingField);
    expect(await screen.findByRole('tooltip', {}, { timeout: 5000 })).toHaveTextContent('hierarchy.ownValueFieldTooltip');
    await user.unhover(rowSpacingField);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(), { timeout: 5000 });

    await user.hover(nutrientDemandField);
    expect(await screen.findByRole('tooltip', {}, { timeout: 5000 })).toHaveTextContent('hierarchy.inheritedFieldTooltip');
  }, 20000);

  it('does not show the legend or any override tooltip when editing a species-level culture', async () => {
    render(
      <CultureForm
        culture={SPECIES_CULTURE}
        cultures={[SPECIES_CULTURE, VARIETY_CULTURE]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    expect(screen.queryByText('hierarchy.ownValueLegendSample')).not.toBeInTheDocument();
  });

  it('does not show the legend when no cultures list is provided (e.g. public library form)', async () => {
    render(
      <CultureForm
        culture={VARIETY_CULTURE}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    expect(screen.queryByText('hierarchy.ownValueLegendSample')).not.toBeInTheDocument();
  });

  it('shows the general crop value in a field the variety does not override, without highlighting it', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <CultureForm
        culture={INHERITING_VARIETY_CULTURE}
        cultures={[LINKED_SPECIES_CULTURE, INHERITING_VARIETY_CULTURE]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    const cropFamilyField = screen.getByLabelText('form.cropFamily');
    expect(cropFamilyField).toHaveValue('Doldenblütler');
    expect(screen.getByLabelText('form.rowSpacingCm')).toHaveValue(30);

    await user.click(cropFamilyField);
    await user.hover(cropFamilyField);
    expect(await screen.findByRole('tooltip', {}, { timeout: 5000 })).toHaveTextContent('hierarchy.inheritedFieldTooltip');
  }, 20000);

  it('does not turn a displayed inherited value into an own override on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={INHERITING_VARIETY_CULTURE}
        cultures={[LINKED_SPECIES_CULTURE, INHERITING_VARIETY_CULTURE]}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    // Set an own value in a field the Kultur does not supply, so the form is
    // dirty and actually submits.
    fireEvent.change(screen.getByLabelText('form.propagationDurationDays'), { target: { value: '14' } });
    const saveButton = screen.getByRole('button', { name: 'form.save' });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
      propagation_duration_days: 14,
      crop_family: '',
      nutrient_demand: '',
      row_spacing_cm: undefined,
    }));
  });

  it('keeps an edited inherited field as the variety\'s own value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={INHERITING_VARIETY_CULTURE}
        cultures={[LINKED_SPECIES_CULTURE, INHERITING_VARIETY_CULTURE]}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('form.cropFamily'), { target: { value: 'Sonderfamilie' } });
    const saveButton = screen.getByRole('button', { name: 'form.save' });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({ crop_family: 'Sonderfamilie' }));
  });
});
