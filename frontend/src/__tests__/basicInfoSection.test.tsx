import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BasicInfoSection } from '../cultures/sections/BasicInfoSection';

const t = ((key: string) => key) as never;

describe('BasicInfoSection', () => {
  it('updates basic text fields', () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{ name: 'Karotte', variety: 'Nantaise', crop_family: 'Apiaceae' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('form.namePlaceholder'), { target: { value: 'Möhre' } });
    fireEvent.change(screen.getByPlaceholderText('form.varietyPlaceholder'), { target: { value: 'Paris' } });
    fireEvent.change(screen.getByPlaceholderText('form.cropFamilyPlaceholder'), { target: { value: 'Asteraceae' } });

    expect(onChange).toHaveBeenCalledWith('name', 'Möhre');
    expect(onChange).toHaveBeenCalledWith('variety', 'Paris');
    expect(onChange).toHaveBeenCalledWith('crop_family', 'Asteraceae');
  });

  it('updates nutrient demand via select', () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{ nutrient_demand: '' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const nutrientCombobox = screen.getByRole('combobox');
    fireEvent.mouseDown(nutrientCombobox);
    fireEvent.click(screen.getByRole('option', { name: 'form.nutrientDemandHigh' }));

    expect(onChange).toHaveBeenCalledWith('nutrient_demand', 'high');
  });

  it('updates the rotation break in years, clearing back to null', () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{ rotation_break_years: 3 }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const rotationBreakInput = screen.getByLabelText('form.rotationBreakYears');
    expect(rotationBreakInput).toHaveValue(3);

    fireEvent.change(rotationBreakInput, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith('rotation_break_years', 5);

    fireEvent.change(rotationBreakInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('rotation_break_years', null);
  });
});
