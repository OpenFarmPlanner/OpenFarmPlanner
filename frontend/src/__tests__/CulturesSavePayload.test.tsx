import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { buildCultureSavePayload } from '../pages/culturesSaveUtils';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import type { Culture } from '../api/types';
import type { FirstVarietyDraft } from '../cultures/CultureForm';

const { listMock, updateMock, createMock, saveCultureMock, saveFirstVarietyMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  saveCultureMock: vi.fn(),
  saveFirstVarietyMock: vi.fn<() => FirstVarietyDraft | undefined>(() => undefined),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      update: updateMock,
      create: createMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({
    cultures,
    selectedCultureId,
    onCultureSelect,
    onEditCulture,
    onCreateCulture,
  }: {
    cultures: Culture[];
    selectedCultureId?: number;
    onCultureSelect: (culture: Culture | null) => void;
    onEditCulture?: (culture: Culture) => void;
    onCreateCulture?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => onCultureSelect({
          id: 1,
          name: 'Karotte',
          variety: 'Nantaise',
          supplier: { id: 10, name: 'Bingenheimer' },
          row_spacing_cm: 20,
          row_spacing_m: 0.2,
        } as Culture)}
      >
        select-culture
      </button>
      <div data-testid="culture-list">{cultures.map((culture) => culture.name).join(', ')}</div>
      <div data-testid="selected-culture-id">{selectedCultureId ?? 'none'}</div>
      <button type="button" onClick={() => onCreateCulture?.()}>Kultur hinzufügen</button>
      <button type="button" onClick={() => cultures[0] && onEditCulture?.(cultures[0])}>Kultur bearbeiten</button>
    </div>
  ),
}));

vi.mock('../cultures/CultureForm', () => ({
  CultureForm: ({ onSave }: { onSave: (culture: Culture, firstVariety?: FirstVarietyDraft) => Promise<void> }): ReactElement => (
    <button
      type="button"
      onClick={() => void onSave(saveCultureMock(), saveFirstVarietyMock())}
    >
      submit-edit
    </button>
  ),
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

describe('Cultures save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Karotte', variety: 'Nantaise', supplier: { id: 10, name: 'Bingenheimer' } },
        ],
      },
    });

    updateMock.mockResolvedValue({
      data: { id: 1, name: 'Karotte', variety: 'Nantaise' },
    });
    createMock.mockResolvedValue({
      data: { id: 2, name: 'Neue Kultur', variety: 'Nova' },
    });
  });

  it('strips legacy meter spacing fields and normalizes seed_rate_unit (g per plant)', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
      row_spacing_cm: 35,
      row_spacing_m: 0.2,
      seed_rate_unit: 'g per plant' as unknown as Culture['seed_rate_unit'],
    } as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));

    const payload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.row_spacing_cm).toBe(35);
    expect(payload.row_spacing_m).toBeUndefined();
    expect(payload.distance_within_row_m).toBeUndefined();
    expect(payload.sowing_depth_m).toBeUndefined();
    expect(payload.seed_rate_unit).toBe('seeds_per_plant');
  });

  it('normalizes gram-per-100-sqm style values to g_per_m2', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
      seed_rate_unit: 'Gramm pro 100 Quadratmeter' as unknown as Culture['seed_rate_unit'],
    } as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.seed_rate_unit).toBe('g_per_m2');
  });

  it('normalizes legacy dash seed rate units to empty values', () => {
    const payload = buildCultureSavePayload({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      seed_rate_unit: '-' as unknown as Culture['seed_rate_unit'],
      seed_rate_direct_unit: '-' as unknown as Culture['seed_rate_direct_unit'],
      seed_rate_pre_cultivation_unit: '-' as unknown as Culture['seed_rate_pre_cultivation_unit'],
    } as Culture);

    expect(payload.seed_rate_unit).toBeNull();
    expect(payload.seed_rate_direct_unit).toBeNull();
    expect(payload.seed_rate_pre_cultivation_unit).toBeNull();
  });

  it('clears seed rate fallback fields when method-specific amounts are removed', () => {
    const payload = buildCultureSavePayload({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      cultivation_types: ['direct_sowing', 'pre_cultivation'],
      seed_rate_direct_value: null,
      seed_rate_direct_unit: 'g_per_m2',
      seed_rate_pre_cultivation_value: null,
      seed_rate_pre_cultivation_unit: 'g_per_m2',
      seed_rate_value: 150,
      seed_rate_unit: 'g_per_m2',
      seed_rate_by_cultivation: {
        direct_sowing: { value: 150, unit: 'g_per_m2' },
        pre_cultivation: { value: 20, unit: 'g_per_m2' },
      },
    } as Culture);

    expect(payload.seed_rate_by_cultivation).toBeNull();
    expect(payload.seed_rate_value).toBeNull();
    expect(payload.seed_rate_unit).toBeNull();
    expect(payload.seed_rate_direct_unit).toBe('g_per_m2');
    expect(payload.seed_rate_pre_cultivation_unit).toBe('g_per_m2');
  });

  it('derives fallback seed rate fields from current method-specific amounts', () => {
    const payload = buildCultureSavePayload({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      cultivation_types: ['direct_sowing'],
      seed_rate_direct_value: 0.125,
      seed_rate_direct_unit: 'g_per_m2',
      seed_rate_value: 150,
      seed_rate_unit: 'g_per_m2',
      seed_rate_by_cultivation: {
        direct_sowing: { value: 150, unit: 'g_per_m2' },
      },
    } as Culture);

    expect(payload.seed_rate_by_cultivation).toEqual({
      direct_sowing: { value: 0.125, unit: 'g_per_m2' },
    });
    expect(payload.seed_rate_value).toBe(0.125);
    expect(payload.seed_rate_unit).toBe('g_per_m2');
  });

  it('includes supplier_data row ids so nested records update instead of duplicate create', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        {
          id: 77,
          supplier_id: 10,
          supplier_name: 'Bingenheimer',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
      ],
    } as unknown as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as { supplier_data_input?: Array<{ id?: number }> };
    expect(payload.supplier_data_input?.[0]?.id).toBe(77);
  });

  it('prefers edited supplier_id over stale nested supplier data in supplier rows', () => {
    const payload = buildCultureSavePayload({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        {
          id: 77,
          supplier: { id: 10, name: 'Lieferant2' },
          supplier_id: 11,
          supplier_name: 'Reinsaat',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
      ],
    } as unknown as Culture);

    expect(payload.supplier_data_input).toHaveLength(1);
    expect(payload.supplier_data_input?.[0]).toEqual(expect.objectContaining({
      id: 77,
      supplier_id: 11,
      supplier_name: 'Reinsaat',
    }));
  });

  it('sends all supplier rows in supplier_data_input when saving', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        {
          id: 77,
          supplier_id: 10,
          supplier_name: 'Bingenheimer',
          supplier_product_name: 'Karotten-Saatgut',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
        {
          id: 78,
          supplier_id: 11,
          supplier_name: 'Dreschflegel',
          supplier_product_name: 'Möhren Premium',
          packaging_sizes: [{ size_value: 50, size_unit: 'g' }],
        },
      ],
      thousand_kernel_weight_g: 3.5,
    } as unknown as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as { supplier_data_input?: Array<{ id?: number }>; thousand_kernel_weight_g?: number };
    expect(payload.supplier_data_input).toHaveLength(2);
    expect(payload.supplier_data_input?.map((row) => row.id)).toEqual([77, 78]);
    expect(payload.thousand_kernel_weight_g).toBe(3.5);
  });

  it('omits empty supplier information rows from the save payload', () => {
    const payload = buildCultureSavePayload({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        { packaging_sizes: [] },
        {
          supplier_id: 10,
          supplier_name: 'Bingenheimer',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
      ],
    } as unknown as Culture);

    expect(payload.supplier_data_input).toHaveLength(1);
    expect(payload.supplier_data_input?.[0]).toEqual(expect.objectContaining({ supplier_id: 10 }));
  });

  it('replaces the local culture entry with the saved API response after editing', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Karotte', variety: 'Nantaise', seed_rate_direct_value: 150 },
        ],
      },
    });
    updateMock.mockResolvedValue({
      data: {
        id: 1,
        name: 'Karotte aktualisiert',
        variety: 'Nantaise',
        seed_rate_direct_value: null,
        seed_rate_direct_unit: 'g_per_m2',
        seed_rate_by_cultivation: null,
        seed_rate_value: null,
        seed_rate_unit: null,
      },
    });
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      seed_rate_direct_value: null,
      seed_rate_direct_unit: 'g_per_m2',
    } as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('culture-list')).toHaveTextContent('Karotte aktualisiert'));
  });

  it('shows and selects newly created culture immediately after save', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, name: 'Karotte', variety: 'Nantaise' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            { id: 1, name: 'Karotte', variety: 'Nantaise' },
            { id: 2, name: 'Neue Kultur', variety: 'Nova' },
          ],
        },
      });
    saveCultureMock.mockReturnValue({
      name: 'Neue Kultur',
      variety: 'Nova',
    } as Culture);

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kultur hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('culture-list')).toHaveTextContent('Karotte, Neue Kultur'));
    expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
  });

  it('also creates a first variety, inheriting the entered values, when a variety name was provided', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, name: 'Karotte', variety: 'Nantaise' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            { id: 1, name: 'Karotte', variety: 'Nantaise' },
            { id: 2, name: 'Neue Kultur', variety: '' },
            { id: 3, name: 'Neue Kultur', variety: 'Nova' },
          ],
        },
      });
    createMock
      .mockResolvedValueOnce({ data: { id: 2, name: 'Neue Kultur', variety: '', crop_species: null } })
      .mockResolvedValueOnce({ data: { id: 3, name: 'Neue Kultur', variety: 'Nova' } });
    saveCultureMock.mockReturnValue({
      name: 'Neue Kultur',
      variety: '',
      row_spacing_cm: 30,
      crop_family: 'Doldenblütler',
    } as Culture);
    saveFirstVarietyMock.mockReturnValueOnce({ name: 'Nova' });

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kultur hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
    const cropPayload = createMock.mock.calls[0][0] as Record<string, unknown>;
    const varietyPayload = createMock.mock.calls[1][0] as Record<string, unknown>;
    expect(cropPayload.variety).toBe('');
    expect(varietyPayload.name).toBe('Neue Kultur');
    expect(varietyPayload.variety).toBe('Nova');
    expect(varietyPayload.row_spacing_cm).toBe(30);
    expect(varietyPayload.crop_family).toBe('Doldenblütler');

    await waitFor(() => expect(screen.getByTestId('culture-list')).toHaveTextContent('Karotte, Neue Kultur'));
  });

  it('passes the explicit copy-defaults opt-in to the first variety create request', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, name: 'Karotte', variety: 'Nantaise' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: null,
          results: [
            { id: 1, name: 'Karotte', variety: 'Nantaise' },
            { id: 2, name: 'Neue Kultur', variety: '' },
            { id: 3, name: 'Neue Kultur', variety: 'Nova' },
          ],
        },
      });
    createMock
      .mockResolvedValueOnce({ data: { id: 2, name: 'Neue Kultur', variety: '', crop_species: null } })
      .mockResolvedValueOnce({ data: { id: 3, name: 'Neue Kultur', variety: 'Nova' } });
    saveCultureMock.mockReturnValue({
      name: 'Neue Kultur',
      variety: '',
      row_spacing_cm: 30,
    } as Culture);
    saveFirstVarietyMock.mockReturnValueOnce({ name: 'Nova', copyValuesToCulture: true });

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kultur hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
    const cropPayload = createMock.mock.calls[0][0] as Record<string, unknown>;
    const varietyPayload = createMock.mock.calls[1][0] as Record<string, unknown>;
    expect(cropPayload.copy_values_to_culture).toBeUndefined();
    expect(varietyPayload.copy_values_to_culture).toBe(true);
  });

  it('applies the library draft to the first variety when one was picked from the suggestions', async () => {
    listMock
      .mockResolvedValueOnce({
        data: { count: 0, next: null, previous: null, results: [] },
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            { id: 2, name: 'Tomate', variety: '' },
            { id: 3, name: 'Tomate', variety: 'Moneymaker' },
          ],
        },
      });
    createMock
      .mockResolvedValueOnce({ data: { id: 2, name: 'Tomate', variety: '', crop_species: 7 } })
      .mockResolvedValueOnce({ data: { id: 3, name: 'Tomate', variety: 'Moneymaker' } });
    saveCultureMock.mockReturnValue({
      name: 'Tomate',
      variety: '',
      crop_species: 7,
      growth_duration_days: 80,
    } as Culture);
    saveFirstVarietyMock.mockReturnValueOnce({
      name: 'Moneymaker',
      draft: {
        variety: 'Moneymaker',
        growth_duration_days: 95,
        source_public_culture: 42,
        source_public_version: 3,
        origin_type: 'imported',
      },
    });

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kultur hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
    const cropPayload = createMock.mock.calls[0][0] as Record<string, unknown>;
    const varietyPayload = createMock.mock.calls[1][0] as Record<string, unknown>;
    // The crop itself keeps its own values; only the variety takes the draft.
    expect(cropPayload.growth_duration_days).toBe(80);
    expect(varietyPayload.name).toBe('Tomate');
    expect(varietyPayload.variety).toBe('Moneymaker');
    expect(varietyPayload.growth_duration_days).toBe(95);
    expect(varietyPayload.source_public_culture).toBe(42);
    expect(varietyPayload.source_public_version).toBe(3);
    expect(varietyPayload.origin_type).toBe('imported');
  });

  it('does not create a second culture when saving an existing crop even if a variety name mock resolves', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
    } as Culture);
    saveFirstVarietyMock.mockReturnValueOnce({ name: 'Nova' });

    render(
      <MemoryRouter>
        <FocusManagerProvider><CommandProvider>
          <Cultures />
        </CommandProvider></FocusManagerProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(createMock).not.toHaveBeenCalled();
  });
});
