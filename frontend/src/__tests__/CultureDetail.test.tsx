import { useState } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CultureDetail } from '../cultures/CultureDetail';
import type { Culture } from '../api/api';
import translations from '@/test-utils/translations';
import i18n from '../i18n/config';

describe('CultureDetail Component', () => {
  const renderCultureDetail = (ui: Parameters<typeof render>[0]) =>
    render(ui, { wrapper: MemoryRouter });

  function mockPhoneLandscapeViewport(): void {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('orientation: landscape')
          || (query.includes('min-width:600px') && query.includes('max-width:899.95px'))
          || (query.includes('min-width:600px') && query.includes('max-width:1199.95px')),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  const mockCultures: Culture[] = [
    {
      id: 1,
      name: 'Tomato',
      variety: 'Cherry',

      growth_duration_days: 56,
      harvest_duration_days: 28,
      harvest_method: 'per_plant',
      notes: 'Frisch und süß.',
    },
    {
      id: 2,
      name: 'Lettuce',

      growth_duration_days: 42,
      harvest_duration_days: 14,
    },
    {
      id: 3,
      name: 'Asparagus',

      growth_duration_days: 730,
      harvest_duration_days: 56,
    },
  ];

  function KeyboardNavigationHarness({
    initialSelectedId = 1,
  }: {
    initialSelectedId?: number;
  }) {
    const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(initialSelectedId);

    return (
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={selectedCultureId}
        onCultureSelect={(culture) => setSelectedCultureId(culture?.id)}
      />
    );
  }

  it('renders search field', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByLabelText(translations.cultures.searchPlaceholder)).toBeInTheDocument();
  });

  it('displays empty state when no culture is selected', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText(translations.cultures.selectPrompt)).toBeInTheDocument();
  });

  it('shows loading state without empty-state flicker', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={[]}
        isLoading
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Kulturen werden geladen…')).toBeInTheDocument();
    expect(screen.queryByText(translations.cultures.emptySearch.title)).not.toBeInTheDocument();
  });

  it('shows onboarding empty-state when no cultures exist', () => {
    renderCultureDetail(
      <CultureDetail
        cultures={[]}
        onCultureSelect={vi.fn()}
        onCreateCulture={vi.fn()}
        onOpenPublicLibrary={vi.fn()}
      />
    );

    expect(screen.getByText('Noch keine Kulturen vorhanden')).toBeInTheDocument();
    expect(screen.getByTestId('InfoOutlinedIcon')).toBeInTheDocument();
    expect(screen.queryByLabelText(translations.cultures.searchPlaceholder)).not.toBeInTheDocument();
    expect(screen.queryByText('Keine Kulturen gefunden')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suche und Filter zurücksetzen' })).not.toBeInTheDocument();
  });

  it('shows filter empty-state when cultures exist but filters have no matches', () => {
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText(translations.cultures.searchPlaceholder);
    fireEvent.change(searchInput, { target: { value: 'ZZZ-kein-treffer' } });

    expect(screen.getByText('Keine Kulturen gefunden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suche und Filter zurücksetzen' })).toBeInTheDocument();
  });

  it('collapses a crop group without changing the selected detail view', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={2}
        onCultureSelect={onSelect}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cherry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kultur aufklappen' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cherry' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kultur zuklappen' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cherry' })).not.toBeInTheDocument();
  });

  it('expands a species row on double click while keeping single click as selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={2}
        onCultureSelect={onSelect}
      />,
    );

    expect(screen.queryByRole('option', { name: 'Cherry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Tomato' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('option', { name: 'Cherry' })).not.toBeInTheDocument();

    await user.dblClick(screen.getByRole('option', { name: 'Tomato' }));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Cherry' })).toBeInTheDocument();
  });

  it('selects the next and previous visible culture with arrow keys and keeps focus in the list', async () => {
    const user = userEvent.setup();
    renderCultureDetail(<KeyboardNavigationHarness />);

    const tomatoOption = screen.getByRole('option', { name: /Tomato/ });
    tomatoOption.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Lettuce/ })).toHaveFocus();
    });

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cherry' })).toHaveFocus();
    });
  });

  it('selects the first and last visible culture with Home and End', async () => {
    const user = userEvent.setup();
    renderCultureDetail(<KeyboardNavigationHarness initialSelectedId={2} />);

    screen.getByRole('option', { name: /Lettuce/ }).focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('heading', { level: 2, name: 'Asparagus' })).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();
  });

  it('does not wrap around at the beginning or end of the culture list', async () => {
    const user = userEvent.setup();
    renderCultureDetail(<KeyboardNavigationHarness />);

    screen.getByRole('option', { name: /Tomato/ }).focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();

    await user.keyboard('{End}');
    expect(screen.getByRole('heading', { level: 2, name: 'Asparagus' })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2, name: 'Asparagus' })).toBeInTheDocument();
  });

  it('navigates only through cultures visible after search filtering', async () => {
    const user = userEvent.setup();
    renderCultureDetail(<KeyboardNavigationHarness />);

    const searchInput = screen.getByLabelText(translations.cultures.searchPlaceholder);
    fireEvent.change(searchInput, { target: { value: 't' } });

    const cultureList = screen.getByRole('listbox', { name: translations.cultures.title });
    const tomatoOption = within(cultureList).getByRole('option', { name: /Tomato/ });
    tomatoOption.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
    expect(within(cultureList).queryByRole('option', { name: /Asparagus/ })).not.toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2, name: 'Lettuce' })).toBeInTheDocument();
  });

  it('does not intercept arrow keys while the search field is focused', async () => {
    const user = userEvent.setup();
    renderCultureDetail(<KeyboardNavigationHarness />);

    const searchInput = screen.getByLabelText(translations.cultures.searchPlaceholder);
    searchInput.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
  });

  it('displays culture details when culture is selected', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();
    expect(screen.getAllByText('Cherry').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: 'Lieferant' })).toBeInTheDocument();
  });

  it('displays the localized name for imported cultures linked to translated species', () => {
    renderCultureDetail(
      <CultureDetail
        cultures={[{
          id: 10,
          name: 'Ackerbohne',
          culture_display_name: 'Broad bean',
          culture_display_language_code: 'en',
          crop_species_translations: {
            de: 'Ackerbohne',
            en: 'Broad bean',
          },
          variety: 'Hangdown',
          origin_type: 'imported',
        }]}
        selectedCultureId={10}
        onCultureSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Broad bean' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Broad bean/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Ackerbohne' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Hangdown').length).toBeGreaterThan(0);
    expect(screen.getByText('Importiert')).toBeInTheDocument();
  });

  it('renders detail sections in the expected order', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );

    const sectionTitles = screen.getAllByRole('heading', { level: 6 }).map((node) => node.textContent?.trim());
    expect(sectionTitles).toEqual([
      'Allgemeine Informationen',
      'Zeitplanung',
      'Abstände',
      'Saatgut',
      'Ernte',
      'Notizen',
    ]);
  });

  it('renders crop detail labels and static values in English', async () => {
    await i18n.changeLanguage('en');
    const cultures: Culture[] = [
      {
        id: 31,
        name: 'Carrot',
        crop_family: 'Apiaceae',
        nutrient_demand: 'medium',
        cultivation_types: ['pre_cultivation', 'direct_sowing'],
        growth_duration_days: 70,
        harvest_duration_days: 21,
        distance_within_row_cm: 5,
        row_spacing_cm: 30,
        sowing_depth_cm: 1.5,
        seed_rate_direct_value: 0.014,
        seed_rate_direct_unit: 'seeds_per_lfm',
        sowing_calculation_safety_percent_direct: 5,
        seed_rate_pre_cultivation_value: 1.357,
        seed_rate_pre_cultivation_unit: 'seeds_per_plant',
        sowing_calculation_safety_percent_pre_cultivation: 10,
        thousand_kernel_weight_g: 1.3,
        harvest_method: 'per_sqm',
        expected_yield: 4.5,
        allow_deviation_delivery_weeks: true,
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={cultures}
        selectedCultureId={31}
        onCultureSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { level: 6, name: 'General information' })).toBeInTheDocument();
    expect(screen.getByText('Crop family')).toBeInTheDocument();
    expect(screen.getByText('Nutrient demand')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Spacing' })).toBeInTheDocument();
    expect(screen.getByText('In-row spacing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Seed' })).toBeInTheDocument();
    expect(screen.getByText('Seed quantity by cultivation type')).toBeInTheDocument();
    expect(screen.getByText('seeds / plant')).toBeInTheDocument();
    expect(screen.getByText('seeds / running m')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'Yield' })).toBeInTheDocument();
    expect(screen.getByText('Expected yield')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders supplier seed data once inside the seed section', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );

    const seedHeading = screen.getByRole('heading', { level: 6, name: 'Saatgut' });
    const harvestHeading = screen.getByRole('heading', { level: 6, name: 'Ernte' });
    const supplierSubheading = screen.getByRole('heading', { level: 3, name: 'Lieferant' });

    expect(screen.getAllByRole('heading', { level: 3, name: 'Lieferant' })).toHaveLength(1);
    expect(seedHeading.compareDocumentPosition(supplierSubheading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(supplierSubheading.compareDocumentPosition(harvestHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('displays harvest information correctly', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText(/56\s+Tage/)).toBeInTheDocument();
    expect(screen.getByText(/28\s+Tage/)).toBeInTheDocument();
    expect(screen.getByText('Ertragseinheit')).toBeInTheDocument();
    expect(screen.getByText('Pro Pflanze')).toBeInTheDocument();
  });


  it('displays sowing depth with one decimal place', () => {
    const mockOnSelect = vi.fn();
    const culturesWithDepth: Culture[] = [
      {
        id: 10,
        name: 'Karotte',
        variety: 'Nantaise',
        sowing_depth_cm: 2,
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithDepth}
        selectedCultureId={10}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('2,0 cm')).toBeInTheDocument();
  });

  it('displays notes when available', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Frisch und süß.')).toBeInTheDocument();
  });

  it('renders supplier homepage as clickable link', () => {
    const mockOnSelect = vi.fn();
    const culturesWithSupplier: Culture[] = [
      {
        id: 12,
        name: 'Salat',
        supplier_data: [{
          supplier: {
            id: 9,
            name: 'ReinSaat',
            homepage_url: 'https://www.reinsaat.at',
            allowed_domains: ['reinsaat.at'],
          },
          supplier_product_url: 'https://www.reinsaat.at',
        }],
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithSupplier}
        selectedCultureId={12}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByRole('link', { name: 'https://www.reinsaat.at' })).toHaveAttribute('href', 'https://www.reinsaat.at');
  });

  it('renders simplified single-supplier seed details without helper text', () => {
    const mockOnSelect = vi.fn();
    const culturesWithSupplierPackages: Culture[] = [
      {
        id: 13,
        name: 'Rote Bete',
        thousand_kernel_weight_g: 4,
        supplier: { id: 9, name: 'ReinSaat', allowed_domains: [] },
        supplier_data: [
          {
            supplier: { id: 9, name: 'ReinSaat', allowed_domains: [] },
            packaging_sizes: [{ size_value: 5, size_unit: 'g' }, { size_value: 10, size_unit: 'g' }, { size_value: 25, size_unit: 'g' }],
          },
        ],
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithSupplierPackages}
        selectedCultureId={13}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Lieferant' })).toBeInTheDocument();
    expect(screen.queryByText('Die folgenden Angaben gelten nur für den ausgewählten Lieferanten dieser Kultur.')).not.toBeInTheDocument();
    expect(screen.getByText('ReinSaat')).toBeInTheDocument();
    expect(screen.getByText('5 g, 10 g, 25 g')).toBeInTheDocument();
    expect(screen.getByText('4 g')).toBeInTheDocument();
  });

  it('formats culture TKG values in German number style', () => {
    const mockOnSelect = vi.fn();
    const culturesWithDecimalTkg: Culture[] = [
      {
        id: 17,
        name: 'Dill',
        thousand_kernel_weight_g: 3.9,
        supplier_data: [
          {
            supplier_name: 'ReinSaat',
            packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
          },
        ],
      },
      {
        id: 18,
        name: 'Koriander',
        thousand_kernel_weight_g: 3.85,
        supplier_data: [
          {
            supplier_name: 'ReinSaat',
            packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
          },
        ],
      },
    ];

    const { rerender } = renderCultureDetail(
      <CultureDetail
        cultures={culturesWithDecimalTkg}
        selectedCultureId={17}
        onCultureSelect={mockOnSelect}
      />
    );
    expect(screen.getByText('3,9 g')).toBeInTheDocument();

    rerender(
      <CultureDetail
        cultures={culturesWithDecimalTkg}
        selectedCultureId={18}
        onCultureSelect={mockOnSelect}
      />
    );
    expect(screen.getByText('3,85 g')).toBeInTheDocument();
  });

  it('renders no-data state when supplier package sizes are empty or invalid', () => {
    const mockOnSelect = vi.fn();
    const culturesWithEmptySupplierPackages: Culture[] = [
      {
        id: 14,
        name: 'Pastinake',
        supplier_data: [
          {
            supplier_name: 'ReinSaat',
            packaging_sizes: [
              { size_value: 0, size_unit: 'g' },
              { size_value: Number.NaN, size_unit: 'g' },
              { size_unit: 'g' } as unknown as { size_value: number; size_unit: 'g' | 'seeds' },
            ],
          },
        ],
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithEmptySupplierPackages}
        selectedCultureId={14}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getAllByText(translations.cultures.noData).length).toBeGreaterThan(0);
  });

  it('renders supplier-specific heading and helper text when multiple suppliers exist', () => {
    const mockOnSelect = vi.fn();
    const culturesWithMultipleSuppliers: Culture[] = [
      {
        id: 16,
        name: 'Fenchel',
        supplier_data: [
          {
            supplier: { id: 2, name: 'Alpha Seeds', allowed_domains: [] },
            packaging_sizes: [{ size_value: 5, size_unit: 'g' }],
          },
          {
            supplier: { id: 3, name: 'Beta Seeds', allowed_domains: [] },
            packaging_sizes: [{ size_value: 10, size_unit: 'g' }],
          },
        ],
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithMultipleSuppliers}
        selectedCultureId={16}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Kulturspezifische Lieferantendaten' })).toBeInTheDocument();
    expect(screen.getByText('Die folgenden Angaben gelten nur für den ausgewählten Lieferanten dieser Kultur.')).toBeInTheDocument();
    expect(screen.getByText('Alpha Seeds')).toBeInTheDocument();
    expect(screen.getByText('Beta Seeds')).toBeInTheDocument();
    expect(screen.getByText('5 g')).toBeInTheDocument();
    expect(screen.getByText('10 g')).toBeInTheDocument();
  });

  it('uses culture-level TKG and supplier package data in seed section', () => {
    const mockOnSelect = vi.fn();
    const culturesWithLegacyValues: Culture[] = [
      {
        id: 15,
        name: 'Karotte',
        thousand_kernel_weight_g: 99,
        seed_packages: [{ size_value: 999, size_unit: 'g' }],
        supplier_data: [
          {
            supplier_name: 'ReinSaat',
            packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
          },
        ],
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={culturesWithLegacyValues}
        selectedCultureId={15}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('25 g')).toBeInTheDocument();
    expect(screen.getAllByText('1000-Korn-Gewicht (g)')).toHaveLength(1);
    expect(screen.getByText('99 g')).toBeInTheDocument();
    expect(screen.queryByText('999 g')).not.toBeInTheDocument();
  });

  it('keeps selected culture visible even when active search filter does not match', () => {
    const mockOnSelect = vi.fn();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );

    const searchInput = screen.getByLabelText(translations.cultures.searchPlaceholder);
    fireEvent.change(searchInput, { target: { value: 'zzzz-no-match' } });

    expect(screen.getByRole('heading', { level: 2, name: 'Tomato' })).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('shows cultivation types as text and per-method seed-rate table', () => {
    const mockOnSelect = vi.fn();
    const cultures: Culture[] = [
      {
        id: 11,
        name: 'Möhre',
        cultivation_types: ['pre_cultivation', 'direct_sowing'],
        seed_rate_direct_value: 0.014,
        seed_rate_direct_unit: 'seeds_per_lfm',
        sowing_calculation_safety_percent_direct: 5,
        seed_rate_pre_cultivation_value: 1.357,
        seed_rate_pre_cultivation_unit: 'seeds_per_plant',
        sowing_calculation_safety_percent_pre_cultivation: 10,
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={cultures}
        selectedCultureId={11}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Pflanzung, Direktsaat')).toBeInTheDocument();
    expect(screen.getByText('Saatgutmenge nach Anbauart')).toBeInTheDocument();
    expect(screen.getByText('1,357')).toBeInTheDocument();
    expect(screen.getByText('0,014')).toBeInTheDocument();
    expect(screen.getByText('Korn / Pflanze')).toBeInTheDocument();
    expect(screen.getByText('Korn / lfm')).toBeInTheDocument();
    expect(screen.getByText('10 %')).toBeInTheDocument();
    expect(screen.getByText('5 %')).toBeInTheDocument();
  });

  it('shows simplified seed view for a single active cultivation method', () => {
    const mockOnSelect = vi.fn();
    const cultures: Culture[] = [
      {
        id: 21,
        name: 'Spinat',
        cultivation_types: ['pre_cultivation'],
        seed_rate_direct_value: 20,
        seed_rate_direct_unit: 'seeds_per_lfm',
        sowing_calculation_safety_percent_direct: 9,
        seed_rate_pre_cultivation_value: 0.125,
        seed_rate_pre_cultivation_unit: 'g_per_m2',
        sowing_calculation_safety_percent_pre_cultivation: 11,
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={cultures}
        selectedCultureId={21}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getAllByText('Pflanzung').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Direktsaat')).toHaveLength(0);
    expect(screen.queryByText('Saatgutmenge nach Anbauart')).not.toBeInTheDocument();
    expect(screen.queryByText('Methode')).not.toBeInTheDocument();
    expect(screen.getByText('Menge')).toBeInTheDocument();
    expect(screen.getByText('0,125 g / m²')).toBeInTheDocument();
    expect(screen.getByText('11 %')).toBeInTheDocument();
    expect(screen.queryByText('9 %')).not.toBeInTheDocument();
  });

  it('marks variety values as from the crop or own values', () => {
    const cultures: Culture[] = [
      {
        id: 31,
        name: 'Tomate',
        variety: '',
        crop_species: 7,
        crop_family: 'Nachtschattengewächse',
        nutrient_demand: 'high',
        cultivation_types: ['pre_cultivation'],
        growth_duration_days: 78,
        harvest_duration_days: 56,
        row_spacing_cm: 80,
        distance_within_row_cm: 50,
        seed_rate_pre_cultivation_value: 1.2,
        seed_rate_pre_cultivation_unit: 'seeds_per_plant',
        sowing_calculation_safety_percent_pre_cultivation: 20,
        thousand_kernel_weight_g: 3.1,
        harvest_method: 'per_plant',
        expected_yield: 4.5,
      },
      {
        id: 32,
        name: 'Tomate',
        variety: 'Roma',
        crop_species: 7,
        growth_duration_days: 72,
        row_spacing_cm: 70,
        thousand_kernel_weight_g: 3.2,
      },
    ];

    renderCultureDetail(
      <CultureDetail
        cultures={cultures}
        selectedCultureId={32}
        onCultureSelect={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();
    expect(screen.getAllByText('Roma').length).toBeGreaterThan(0);
    expect(screen.getByText('72 Tage')).toBeInTheDocument();
    expect(screen.getByText('56 Tage')).toBeInTheDocument();
    expect(screen.getByText('1,2 Korn / Pflanze')).toBeInTheDocument();
    expect(screen.getByText('3,2 g')).toBeInTheDocument();
    expect(screen.getByText('Grüner Rand: gilt nur für diese Sorte.')).toBeInTheDocument();
    expect(screen.queryByText('Eigener Wert')).not.toBeInTheDocument();
    expect(screen.queryByText('Aus der Kultur')).not.toBeInTheDocument();
  });

  it('shows edit and plan as labeled primary actions and keeps secondary actions in overflow', async () => {
    const user = userEvent.setup();
    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={vi.fn()}
        onEditCulture={vi.fn()}
        onCreatePlan={vi.fn()}
        onOpenHistory={vi.fn()}
        onPublishCulture={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anbauplan hinzufügen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));

    expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Versionen' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Veröffentlichen' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();
  });

  it('keeps the portrait mobile culture UI in short-height phone landscape', () => {
    mockPhoneLandscapeViewport();

    renderCultureDetail(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={vi.fn()}
        onEditCulture={vi.fn()}
        onCreatePlan={vi.fn()}
        onOpenHistory={vi.fn()}
        onPublishCulture={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Kultur auswählen' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Kulturen' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Bearbeiten' })).getByText('Bearbeiten')).toHaveStyle({
      display: 'none',
    });
    expect(within(screen.getByRole('button', { name: 'Anbauplan hinzufügen' })).getByText('Anbauplan hinzufügen')).toHaveStyle({
      display: 'none',
    });
  });
});
