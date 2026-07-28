import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { cultureDuplicateCheckMock, publicCultureMatchMock, supplierCreateMock, supplierListMock } = vi.hoisted(() => ({
  cultureDuplicateCheckMock: vi.fn().mockResolvedValue({ data: { exists: false } }),
  publicCultureMatchMock: vi.fn().mockResolvedValue({ data: { exists: false, culture: null } }),
  supplierCreateMock: vi.fn(),
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
      match: publicCultureMatchMock,
    },
    supplierAPI: {
      list: supplierListMock,
      create: supplierCreateMock,
    },
  };
});

vi.mock('../cultures/sections/BasicInfoSection', () => ({
  BasicInfoSection: ({
    formData,
    errors,
    identityHint,
    onChange,
  }: {
    formData: Partial<Culture>;
    errors: Record<string, string>;
    identityHint?: ReactNode;
    onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  }) => (
    <div>
      <input
        aria-label="name-input"
        value={formData.name ?? ''}
        onChange={(event) => onChange('name', event.target.value)}
      />
      {errors.name ? <span>{errors.name}</span> : null}
      <input
        aria-label="variety-input"
        value={formData.variety ?? ''}
        onChange={(event) => onChange('variety', event.target.value)}
      />
      {errors.variety ? <span>{errors.variety}</span> : null}
      {identityHint}
    </div>
  ),
}));

vi.mock('../cultures/sections/SpacingSection', () => ({
  SpacingSection: ({ formData, onChange }: { formData: Partial<Culture>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <input
      aria-label="row-spacing-input"
      value={formData.row_spacing_cm ?? ''}
      onChange={(event) => onChange('row_spacing_cm', Number(event.target.value))}
    />
  ),
}));

vi.mock('../cultures/sections/TimingSection', () => ({ TimingSection: () => null }));
vi.mock('../cultures/sections/HarvestSection', () => ({ HarvestSection: () => null }));
vi.mock('../cultures/sections/SeedingSection', () => ({
  SeedingSection: ({ formData, onChange }: { formData: Partial<Culture>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <input
      aria-label="thousand-kernel-input"
      value={formData.thousand_kernel_weight_g ?? ''}
      onChange={(event) => onChange('thousand_kernel_weight_g', event.target.value === '' ? undefined : Number(event.target.value))}
    />
  ),
}));
vi.mock('../cultures/sections/ColorSection', () => ({ ColorSection: () => null }));
vi.mock('../cultures/sections/NotesSection', () => ({ NotesSection: () => null }));

const CULTURE_A: Culture = {
  id: 1,
  name: 'Karotte',
  variety: 'Nantaise',
  supplier: { id: 10, name: 'Bingenheimer' },
};

const CULTURE_B: Culture = {
  id: 2,
  name: 'Salat',
  variety: 'Batavia',
  supplier: { id: 11, name: 'Dreschflegel' },
};

const dispatchSaveShortcut = (options: { metaKey?: boolean; repeat?: boolean } = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: !options.metaKey,
    key: 's',
    metaKey: Boolean(options.metaKey),
    repeat: Boolean(options.repeat),
  });
  fireEvent(window, event);
  return event;
};

describe('CultureForm', () => {
  beforeEach(() => {
    cultureDuplicateCheckMock.mockReset();
    cultureDuplicateCheckMock.mockResolvedValue({ data: { exists: false } });
    publicCultureMatchMock.mockReset();
    publicCultureMatchMock.mockResolvedValue({ data: { exists: false, culture: null } });
    supplierCreateMock.mockReset();
    supplierCreateMock.mockResolvedValue({
      data: { id: 42, name: 'Reinsaat', homepage_url: 'https://reinsaat.at', allowed_domains: [] },
    });
    supplierListMock.mockReset();
    supplierListMock.mockResolvedValue({ data: { results: [] } });
  });

  it('renders supplier selection states based on supplier availability', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('form.noSuppliers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    expect(await screen.findByRole('heading', { name: 'form.createSuppliers' })).toBeInTheDocument();
  });

  it('opens supplier creation without navigation and preserves culture changes when cancelled', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'form.createSuppliers' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));

    expect(await screen.findByRole('heading', { name: 'form.createSuppliers' })).toBeInTheDocument();
    expect(screen.getByLabelText('name-input')).toHaveValue('Neue Karotte');

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Reinsaat' } });
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'form.createSuppliers' })).not.toBeInTheDocument();
    });

    expect(supplierCreateMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('name-input')).toHaveValue('Neue Karotte');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('creates a supplier inline, selects it, and keeps edited culture fields dirty', async () => {
    supplierListMock
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({
        data: { results: [{ id: 42, name: 'Reinsaat', homepage_url: 'https://reinsaat.at', allowed_domains: [] }] },
      });
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'form.createSuppliers' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Reinsaat' } });
    fireEvent.change(screen.getByLabelText('homepage'), { target: { value: 'reinsaat.at' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));

    await waitFor(() => expect(supplierCreateMock).toHaveBeenCalledTimes(1));
    expect(supplierCreateMock).toHaveBeenCalledWith('Reinsaat', 'https://reinsaat.at', []);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'form.createSuppliers' })).not.toBeInTheDocument());

    const supplierSelect = await screen.findByRole('combobox');
    expect(supplierSelect).toHaveTextContent('Reinsaat');
    expect(screen.getByLabelText('name-input')).toHaveValue('Neue Karotte');
    expect(screen.getByText('messages.unsavedChanges')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
      name: 'Neue Karotte',
      supplier_data: [
        expect.objectContaining({
          supplier_id: 42,
          supplier: expect.objectContaining({ id: 42, name: 'Reinsaat' }),
          supplier_name: 'Reinsaat',
        }),
      ],
    }));
  });

  it('keeps supplier creation open with entered values after an API error', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });
    supplierCreateMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { name: ['Ein Lieferant mit diesem Namen existiert bereits.'] } },
    });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'form.createSuppliers' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Reinsaat' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));

    expect(await screen.findByText('Ein Lieferant mit diesem Namen existiert bereits.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'form.createSuppliers' })).toBeInTheDocument();
    expect(screen.getByLabelText('name')).toHaveValue('Reinsaat');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('prevents duplicate supplier creation from double submit clicks', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });
    let resolveCreate: (value: { data: { id: number; name: string; homepage_url: string; allowed_domains: string[] } }) => void = () => {};
    supplierCreateMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'form.createSuppliers' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Reinsaat' } });
    const submitButton = screen.getByRole('button', { name: 'form.createSuppliers' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(supplierCreateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ data: { id: 42, name: 'Reinsaat', homepage_url: '', allowed_domains: [] } });
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'form.createSuppliers' })).not.toBeInTheDocument());
  });

  it('closes only the supplier dialog on Escape', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'form.createSuppliers' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    expect(await screen.findByRole('heading', { name: 'form.createSuppliers' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'form.createSuppliers' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'form.editTitle' })).toBeInTheDocument();
  });

  it('shows only real suppliers in the supplier dropdown when supplier options are available', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [{ id: 99, name: 'New Supplier' }] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'New Supplier' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'form.supplierPlaceholder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'form.newSupplierOption' })).not.toBeInTheDocument();
  });

  it('falls back to empty supplier selection when saved supplier is not in options', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [{ id: 99, name: 'Different Supplier' }] } });

    render(
      <CultureForm
        culture={{
          ...CULTURE_A,
          supplier_data: [{ supplier_id: 10, supplier_name: 'Bingenheimer', packaging_sizes: [] }],
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.getByRole('combobox')).toHaveTextContent('form.supplierPlaceholder');
  });

  it('saves the newly selected supplier in supplier data rows', async () => {
    supplierListMock.mockResolvedValueOnce({
      data: {
        results: [
          { id: 10, name: 'Lieferant2' },
          { id: 11, name: 'Reinsaat' },
        ],
      },
    });
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={{
          ...CULTURE_A,
          supplier_data: [
            {
              id: 77,
              supplier: { id: 10, name: 'Lieferant2' },
              supplier_id: 10,
              supplier_name: 'Lieferant2',
              packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
            },
          ],
        }}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Lieferant2')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByText('Lieferant2'));
    fireEvent.click(screen.getByRole('option', { name: 'Reinsaat' }));
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      supplier_data: [
        expect.objectContaining({
          id: 77,
          supplier: { id: 11, name: 'Reinsaat' },
          supplier_id: 11,
          supplier_name: 'Reinsaat',
        }),
      ],
    }));
  });

  it('loads all existing supplier rows when editing a culture', async () => {
    supplierListMock.mockResolvedValueOnce({
      data: {
        results: [
          { id: 10, name: 'Bingenheimer' },
          { id: 11, name: 'Dreschflegel' },
        ],
      },
    });

    render(
      <CultureForm
        culture={{
          ...CULTURE_A,
          supplier_data: [
            { supplier_id: 10, supplier_name: 'Bingenheimer', packaging_sizes: [{ size_value: 25, size_unit: 'g' }] },
            { supplier_id: 11, supplier_name: 'Dreschflegel', packaging_sizes: [{ size_value: 50, size_unit: 'g' }] },
          ],
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bingenheimer')).toBeInTheDocument();
      expect(screen.getByText('Dreschflegel')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
  });

  it('renders separated general and supplier-specific sections', () => {
    render(<CultureForm culture={CULTURE_A} onSave={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);

    expect(screen.getByText('form.generalInfoSectionTitle')).toBeInTheDocument();
    expect(screen.getByText('form.supplierDataSectionTitle')).toBeInTheDocument();
  });

  it('shows duplicate culture validation and blocks saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    cultureDuplicateCheckMock.mockResolvedValueOnce({ data: { exists: true } });

    render(<CultureForm onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Karotte' } });
    fireEvent.change(screen.getByLabelText('variety-input'), { target: { value: 'Nantaise' } });

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Karotte', variety: 'Nantaise', exclude_id: undefined },
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText('form.duplicateNameVariety')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'form.create' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'form.create' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows public library match hint only when creating a culture', async () => {
    cultureDuplicateCheckMock.mockResolvedValue({ data: { exists: false } });
    publicCultureMatchMock.mockResolvedValue({
      data: {
        exists: true,
        culture: { id: 42, name: 'Karotte', variety: 'Nantaise' },
      },
    });

    render(
      <CultureForm
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
        onViewPublicLibraryMatch={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Karotte' } });
    fireEvent.change(screen.getByLabelText('variety-input'), { target: { value: 'Nantaise' } });

    await waitFor(() => expect(publicCultureMatchMock).toHaveBeenCalledWith(
      { name: 'Karotte', variety: 'Nantaise' },
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText('form.publicLibraryMatchHint')).toBeInTheDocument();
  });

  it('does not check or show public library match hint when editing a culture', async () => {
    cultureDuplicateCheckMock.mockResolvedValue({ data: { exists: false } });
    publicCultureMatchMock.mockResolvedValue({
      data: {
        exists: true,
        culture: { id: 42, name: 'Neue Karotte', variety: 'Nantaise' },
      },
    });

    render(
      <CultureForm
        culture={CULTURE_A}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
        onViewPublicLibraryMatch={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    expect(publicCultureMatchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('form.publicLibraryMatchHint')).not.toBeInTheDocument();
  });

  it('saves changed form data when editing a culture', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      name: 'Neue Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
    }));
  });

  it('closes without saving when an edited culture has no effective changes', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('treats trim-only text edits as unchanged when saving an edited culture', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: '  Karotte  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('saves exactly once after a real edit and then treats the saved data as unchanged when reopened', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const { rerender } = render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    rerender(
      <CultureForm
        culture={{ ...CULTURE_A, name: 'Neue Karotte' }}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('saves the active culture edit dialog with Ctrl+S', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByLabelText('name-input');
    fireEvent.change(nameInput, { target: { value: 'Neue Karotte' } });
    nameInput.focus();

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'form.save' })).not.toBeDisabled());
    const event = dispatchSaveShortcut();

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      name: 'Neue Karotte',
      variety: 'Nantaise',
    }));
  });

  it('saves the active culture edit dialog with Cmd+S', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const varietyInput = screen.getByLabelText('variety-input');
    fireEvent.change(varietyInput, { target: { value: 'Nantaise 2' } });
    varietyInput.focus();
    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Karotte', variety: 'Nantaise 2', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'form.save' })).not.toBeDisabled());
    const event = dispatchSaveShortcut({ metaKey: true });

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('prevents browser save but does not submit when Ctrl+S save is disabled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    cultureDuplicateCheckMock.mockResolvedValueOnce({ data: { exists: true } });

    render(<CultureForm onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByLabelText('name-input');
    fireEvent.change(nameInput, { target: { value: 'Karotte' } });
    fireEvent.change(screen.getByLabelText('variety-input'), { target: { value: 'Nantaise' } });
    nameInput.focus();

    await screen.findByText('form.duplicateNameVariety');
    const event = dispatchSaveShortcut();

    expect(event.defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('prevents browser save before any field receives focus in the edit dialog', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={onCancel} />);

    (document.activeElement as HTMLElement | null)?.blur();
    const event = dispatchSaveShortcut();

    expect(event.defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not start duplicate saves when Ctrl+S is pressed repeatedly', async () => {
    let resolveSave: () => void = () => {};
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByLabelText('name-input');
    fireEvent.change(nameInput, { target: { value: 'Neue Karotte' } });
    nameInput.focus();
    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'form.save' })).not.toBeDisabled());
    const firstEvent = dispatchSaveShortcut();
    const secondEvent = dispatchSaveShortcut();

    expect(firstEvent.defaultPrevented).toBe(true);
    expect(secondEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    resolveSave();
  });

  it('keeps Enter behavior unchanged in culture edit inputs', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByLabelText('name-input');
    nameInput.focus();
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves spacing values for culture edit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_B} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('row-spacing-input'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 2,
      name: 'Salat',
      variety: 'Batavia',
      row_spacing_cm: 35,
      supplier: { id: 11, name: 'Dreschflegel' },
    }));
  });

  it('saves thousand-kernel weight directly on culture data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('thousand-kernel-input'), { target: { value: '4.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      thousand_kernel_weight_g: 4.2,
    }));
  });

  it('maps legacy seed_supplier into supplier field for validation and save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={{ id: 3, name: 'Mangold', variety: 'Rainbow', seed_supplier: 'Legacy Seeds' }} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('row-spacing-input'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      supplier: expect.objectContaining({ name: 'Legacy Seeds' }),
      row_spacing_cm: 40,
    }));
  });

  it('resets form state when a different culture is opened for editing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Zwischenstand' } });

    rerender(<CultureForm culture={CULTURE_B} onSave={onSave} onCancel={() => {}} />);

    expect(screen.getByLabelText('name-input')).toHaveValue('Salat');
    expect(screen.getByLabelText('variety-input')).toHaveValue('Batavia');

    fireEvent.change(screen.getByLabelText('row-spacing-input'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 2,
      name: 'Salat',
      variety: 'Batavia',
      row_spacing_cm: 42,
      supplier: { id: 11, name: 'Dreschflegel' },
    }));
  });

  it('renders save error inline instead of snackbar overlap', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });
    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('messages.updateError')).toBeInTheDocument();
  });

  it('ignores empty supplier information rows when detecting changes', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('form.supplierDataMissingSupplier')).not.toBeInTheDocument();
  });

  it('blocks partially filled supplier information rows without a supplier', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ supplier_product_name: 'Artikel ohne Lieferant', packaging_sizes: [] }] }}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });
    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    expect(await screen.findByText('form.supplierDataMissingSupplier')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps focus inside the dialog when opened', async () => {
    render(<CultureForm culture={CULTURE_A} onSave={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);

    const dialogRoot = document.querySelector('.MuiDialog-root') as HTMLElement | null;
    expect(dialogRoot).toBeTruthy();
    await waitFor(() => expect(dialogRoot).toContainElement(document.activeElement as HTMLElement));
  });

  it('keeps normal input keyboard handling without scrolling dialog content', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);
    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });

    const nameInput = screen.getByLabelText('name-input');
    (nameInput as HTMLInputElement).focus();

    fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
    fireEvent.keyDown(nameInput, { key: 'PageDown' });
    fireEvent.keyDown(nameInput, { key: ' ' });

    expect(content?.scrollTop).toBe(0);
  });

});
