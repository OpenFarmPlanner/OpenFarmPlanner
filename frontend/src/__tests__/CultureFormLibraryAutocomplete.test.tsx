/**
 * Renders CultureForm against the *real* BasicInfoSection.
 *
 * CultureForm.test.tsx mocks that section away, so it verifies the form's
 * callbacks but not that the fields are actually wired to them. The Add-crop
 * dialog once lost its library prefill entirely — the Name field kept
 * rendering suggestions while the only code path that prefills and links moved
 * to a Variety field that `formKind="crop"` never renders — and every mocked
 * test still passed. These cases cover that gap at the DOM level.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { PublicCulture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    cultureAPI: { ...actual.cultureAPI, duplicateCheck: cultureDuplicateCheckMock },
    publicCultureAPI: { ...actual.publicCultureAPI, list: publicCultureListMock },
    supplierAPI: { list: supplierListMock, create: vi.fn() },
  };
});

const GENERAL_TOMATO = {
  id: 40,
  status: 'published',
  name: 'Tomate',
  display_name: 'Tomate',
  variety: '',
  crop_species: 7,
  crop_family: 'Nachtschattengewächse',
  growth_duration_days: 80,
  version: 2,
} as PublicCulture;

const MONEYMAKER = {
  id: 42,
  status: 'published',
  name: 'Tomate',
  display_name: 'Tomate',
  variety: 'Moneymaker',
  crop_species: 7,
  version: 3,
} as PublicCulture;

const mockLibrary = (speciesResults: PublicCulture[]) => {
  publicCultureListMock.mockImplementation((params: { q?: string; crop_species?: number }) => Promise.resolve({
    data: { results: params.crop_species === 7 ? speciesResults : [MONEYMAKER] },
  }));
};

const getNameInput = () => screen.getByRole('combobox', { name: /form\.name/ });

describe('CultureForm library autocomplete (real BasicInfoSection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cultureDuplicateCheckMock.mockResolvedValue({ data: { exists: false } });
    supplierListMock.mockResolvedValue({ data: { results: [] } });
    publicCultureListMock.mockResolvedValue({ data: { results: [] } });
  });

  it('suggests public crop species while typing in the Add-crop dialog', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });

    await waitFor(() => expect(publicCultureListMock).toHaveBeenCalledWith(
      { q: 'Toma' },
      expect.any(AbortSignal),
    ));
    const options = await screen.findAllByRole('option');
    // Species-level only — never a "Species · Variety" combination.
    expect(options.map((option) => option.textContent)).toEqual(['Tomate']);
  });

  it('prefills the general fields and links the library when a name suggestion is picked', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Tomate' }));

    await waitFor(() => expect(screen.getByText('form.publicCultureSourceHint')).toBeInTheDocument());
    expect(getNameInput()).toHaveValue('Tomate');
    expect(screen.getByLabelText(/form\.cropFamily/)).toHaveValue('Nachtschattengewächse');
  });

  it('suggests only the matched species varieties in the optional first-variety field', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Tomate' }));

    const firstVarietyInput = screen.getByRole('combobox', { name: /form\.firstVarietyLabel/ });
    await waitFor(() => expect(publicCultureListMock).toHaveBeenCalledWith(
      { crop_species: 7 },
      expect.any(AbortSignal),
    ));
    fireEvent.change(firstVarietyInput, { target: { value: 'Mo' } });

    const listbox = await screen.findByRole('listbox');
    // The general entry carries an empty variety and must not become an option.
    expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual(['Moneymaker']);
  });

  it('labels suggestions as coming from the public crop library while typing', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });
    await screen.findByRole('option', { name: 'Tomate' });

    expect(screen.getByText('form.publicCultureSuggestionsGroupLabel')).toBeInTheDocument();
  });

  it('links the first variety and shows the source hint when its suggestion is picked from the dropdown', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Tomate' }));

    const firstVarietyInput = screen.getByRole('combobox', { name: /form\.firstVarietyLabel/ });
    await waitFor(() => expect(publicCultureListMock).toHaveBeenCalledWith(
      { crop_species: 7 },
      expect.any(AbortSignal),
    ));
    fireEvent.change(firstVarietyInput, { target: { value: 'Mo' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Moneymaker' }));

    await waitFor(() => expect(screen.getByText('form.firstVarietySourceHint')).toBeInTheDocument());
  });

  it('offers an explicit apply action instead of silently linking when typed first-variety text matches exactly', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Toma' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Tomate' }));

    const firstVarietyInput = screen.getByRole('combobox', { name: /form\.firstVarietyLabel/ });
    await waitFor(() => expect(publicCultureListMock).toHaveBeenCalledWith(
      { crop_species: 7 },
      expect.any(AbortSignal),
    ));
    fireEvent.change(firstVarietyInput, { target: { value: 'Moneymaker' } });
    fireEvent.keyDown(firstVarietyInput, { key: 'Escape' });

    expect(screen.queryByText('form.firstVarietySourceHint')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText('form.publicCultureApplyAction'));

    await waitFor(() => expect(screen.getByText('form.firstVarietySourceHint')).toBeInTheDocument());
  });

  it('prefills the general crop fields when a Sorte is picked without ever explicitly linking the Name', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    // Exact-matching text alone (no dropdown pick) is enough to unlock the
    // Sorte suggestions, but it does not link crop_species on the draft.
    fireEvent.change(getNameInput(), { target: { value: 'Tomate' } });
    await screen.findByRole('option', { name: 'Tomate' });

    const firstVarietyInput = screen.getByRole('combobox', { name: /form\.firstVarietyLabel/ });
    await waitFor(() => expect(publicCultureListMock).toHaveBeenCalledWith(
      { crop_species: 7 },
      expect.any(AbortSignal),
    ));
    fireEvent.change(firstVarietyInput, { target: { value: 'Mo' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Moneymaker' }));

    // The parent crop draft must also carry the species' general fields now,
    // not just the (separately saved) variety row.
    await waitFor(() => expect(screen.getByLabelText(/form\.cropFamily/)).toHaveValue('Nachtschattengewächse'));
  });

  it('keeps the first-variety field as plain free text for an unmatched crop name', async () => {
    mockLibrary([GENERAL_TOMATO, MONEYMAKER]);

    render(<CultureForm formKind="crop" onSave={vi.fn()} onCancel={() => {}} />);
    fireEvent.change(getNameInput(), { target: { value: 'Tomaten' } });
    await screen.findByRole('option', { name: 'Tomate' });

    // "Tomaten" never exactly matched the species, so no variety lookup ran.
    expect(publicCultureListMock).not.toHaveBeenCalledWith(
      { crop_species: 7 },
      expect.any(AbortSignal),
    );
    const firstVarietyInput = screen.getByRole('combobox', { name: /form\.firstVarietyLabel/ });
    fireEvent.change(firstVarietyInput, { target: { value: 'Mo' } });
    expect(firstVarietyInput).toHaveValue('Mo');
    // The name field's own dropdown may still be open, so assert on the
    // variety suggestion specifically rather than on any listbox.
    expect(screen.queryByRole('option', { name: 'Moneymaker' })).not.toBeInTheDocument();
  });
});
