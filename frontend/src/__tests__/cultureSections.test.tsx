import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ColorSection } from '../cultures/sections/ColorSection';
import { NotesSection } from '../cultures/sections/NotesSection';
import { SpacingSection } from '../cultures/sections/SpacingSection';
import { SeedingSection } from '../cultures/sections/SeedingSection';
import { HarvestSection } from '../cultures/sections/HarvestSection';
import { BasicInfoSection } from '../cultures/sections/BasicInfoSection';

const translations: Record<string, string> = {
  'form.sowingCalculationSafetyPercentLabel': 'Sicherheitszuschlag für Saatgut (%)',
  'form.thousandKernelWeightLabel': '1000-Korn-Gewicht (g)',
  'form.seedUnitPlaceholder': 'Einheit auswählen',
};

const t = (key: string, options?: Record<string, unknown>) => {
  if (typeof options?.defaultValue === 'string') {
    return options.defaultValue;
  }
  return translations[key] ?? key;
};

describe('culture form UI sections', () => {
  it('renders ColorSection with default color and emits display color changes', () => {
    const onChange = vi.fn();

    render(
      <ColorSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
        defaultColor="#00ff00"
      />
    );

    const colorInput = screen.getByLabelText('form.displayColor');
    expect(colorInput).toHaveValue('#00ff00');
    expect(screen.getByText('#00FF00')).toBeInTheDocument();

    fireEvent.change(colorInput, { target: { value: '#123456' } });

    expect(onChange).toHaveBeenCalledWith('display_color', '#123456');
    expect(screen.getByText('form.displayColorHelp')).toBeInTheDocument();
  });

  it('renders the saved display color as a visible hex value', () => {
    render(
      <ColorSection
        formData={{ display_color: '#7cb342' }}
        errors={{}}
        onChange={vi.fn()}
        t={t}
        defaultColor="#00ff00"
      />
    );

    expect(screen.getByLabelText('form.displayColor')).toHaveValue('#7cb342');
    expect(screen.getByText('#7CB342')).toBeInTheDocument();
  });

  it('keeps invalid display color validation visible', () => {
    render(
      <ColorSection
        formData={{ display_color: '#12ZZ00' }}
        errors={{ display_color: 'form.displayColorError' }}
        onChange={vi.fn()}
        t={t}
        defaultColor="#00ff00"
      />
    );

    expect(screen.getByLabelText('form.displayColor')).toHaveValue('#00ff00');
    expect(screen.getByText('#12ZZ00')).toBeInTheDocument();
    expect(screen.getByText('form.displayColorError')).toBeInTheDocument();
  });

  it('renders NotesSection and emits note changes', () => {
    const onChange = vi.fn();

    render(
      <NotesSection
        formData={{ notes: 'Bestehende Notiz' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const notesInput = screen.getByLabelText('form.notes');
    expect(notesInput).toHaveValue('Bestehende Notiz');

    fireEvent.change(notesInput, { target: { value: 'Neue Notiz' } });

    expect(onChange).toHaveBeenCalledWith('notes', 'Neue Notiz');
  });

  it('renders SpacingSection and parses numeric inputs', () => {
    const onChange = vi.fn();

    render(
      <SpacingSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('Abstand in der Reihe (cm)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Reihenabstand (cm)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Saattiefe (cm)'), { target: { value: '2.1' } });

    expect(onChange).toHaveBeenCalledWith('distance_within_row_cm', 25);
    expect(onChange).toHaveBeenCalledWith('row_spacing_cm', 40);
    expect(onChange).toHaveBeenCalledWith('sowing_depth_cm', 2.1);

  });

  it('renders SeedingSection and handles method-specific seed changes', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ cultivation_types: ['direct_sowing'], seed_rate_direct_value: 5, seed_rate_direct_unit: 'g_per_lfm' }}
        errors={{ seed_rate_direct_unit: 'Bitte wählen' }}
        onChange={onChange}
        t={t}
      />
    );

    const amountInput = screen.getByLabelText('Menge');
    expect(amountInput).toHaveAttribute('min', '0.001');
    expect(amountInput).toHaveAttribute('step', '0.001');
    fireEvent.change(amountInput, { target: { value: '12.5' } });
    expect(onChange).toHaveBeenCalledWith('seed_rate_direct_value', 12.5);

    const safetyInput = screen.getByLabelText('Sicherheitszuschlag für Saatgut (%)');
    fireEvent.change(safetyInput, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith('sowing_calculation_safety_percent_direct', 10);

    const tkgInput = screen.getByLabelText('1000-Korn-Gewicht (g)');
    fireEvent.change(tkgInput, { target: { value: '3,9' } });
    expect(onChange).toHaveBeenCalledWith('thousand_kernel_weight_g', 3.9);

    expect(screen.getByText('Bitte wählen')).toBeInTheDocument();
  });

  it('renders an empty seed unit placeholder without a synthetic option', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ cultivation_types: ['direct_sowing'], seed_rate_direct_unit: null }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(screen.getByText('Einheit auswählen')).toBeInTheDocument();
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('hides the seed unit tooltip while the dropdown menu is open', async () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ cultivation_types: ['direct_sowing'], seed_rate_direct_unit: 'g_per_m2' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const unitSelect = screen.getByRole('combobox');
    fireEvent.mouseOver(unitSelect);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('form.seedRateHelp');

    fireEvent.mouseDown(unitSelect);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows method blocks based on selected cultivation types', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SeedingSection
        formData={{ cultivation_types: ['direct_sowing'] }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );
    expect(screen.getByText('Saatgutbedarf Direktsaat')).toBeInTheDocument();
    expect(screen.queryByText('Saatgutbedarf Pflanzung')).not.toBeInTheDocument();

    rerender(
      <SeedingSection
        formData={{ cultivation_types: ['pre_cultivation', 'direct_sowing'] }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );
    expect(screen.getByText('Saatgutbedarf Direktsaat')).toBeInTheDocument();
    expect(screen.getByText('Saatgutbedarf Pflanzung')).toBeInTheDocument();
  });

  it('keeps hidden method values and shows them again after re-activation', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SeedingSection
        formData={{
          cultivation_types: ['direct_sowing', 'pre_cultivation'],
          seed_rate_direct_value: 7,
          seed_rate_direct_unit: 'g_per_m2',
          seed_rate_pre_cultivation_value: 3,
          seed_rate_pre_cultivation_unit: 'g_per_m2',
        }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();

    rerender(
      <SeedingSection
        formData={{
          cultivation_types: ['pre_cultivation'],
          seed_rate_direct_value: 7,
          seed_rate_direct_unit: 'g_per_m2',
          seed_rate_pre_cultivation_value: 3,
          seed_rate_pre_cultivation_unit: 'g_per_m2',
        }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );
    expect(screen.queryByDisplayValue('7')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();

    rerender(
      <SeedingSection
        formData={{
          cultivation_types: ['pre_cultivation', 'direct_sowing'],
          seed_rate_direct_value: 7,
          seed_rate_direct_unit: 'g_per_m2',
          seed_rate_pre_cultivation_value: 3,
          seed_rate_pre_cultivation_unit: 'g_per_m2',
        }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );
    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });



  it('renders HarvestSection and parses expected yield input including empty value', () => {
    const onChange = vi.fn();

    render(
      <HarvestSection
        formData={{ expected_yield: 3.5 }}
        errors={{ expected_yield: 'Ungültig' }}
        onChange={onChange}
        t={t}
      />
    );

    const yieldInput = screen.getByLabelText('form.expectedYield (kg)');
    expect(yieldInput).toHaveValue(3.5);

    fireEvent.change(yieldInput, { target: { value: '4.25' } });
    expect(onChange).toHaveBeenCalledWith('expected_yield', 4.25);

    fireEvent.change(yieldInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('expected_yield', undefined);
    expect(screen.getByText('Ungültig')).toBeInTheDocument();
    expect(screen.getByLabelText('form.expectedYield (kg)')).toBeInTheDocument();
  });

  it('name and variety fields enforce maxLength=200 (K-01 regression guard)', () => {
    render(
      <BasicInfoSection
        formData={{ name: '', variety: '' }}
        errors={{}}
        onChange={vi.fn()}
        t={t}
      />
    );

    const nameInput = screen.getByLabelText(/form\.name/i);
    const varietyInput = screen.getByLabelText(/form\.variety/i);

    expect(nameInput).toHaveAttribute('maxlength', '200');
    expect(varietyInput).toHaveAttribute('maxlength', '200');
  });
});
