import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { AreaM2EditCell } from '../components/data-grid/AreaM2EditCell';
import { PlantsCountEditCell } from '../components/data-grid/PlantsCountEditCell';

const gridApiMock = vi.hoisted(() => ({
  setEditCellValue: vi.fn().mockResolvedValue(true),
}));

vi.mock('@mui/x-data-grid', async () => {
  const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid');
  return {
    ...actual,
    useGridApiContext: () => ({ current: gridApiMock }),
  };
});

const baseEditParams = {
  id: 1,
  api: {} as GridRenderEditCellParams['api'],
  row: {},
  rowNode: {} as GridRenderEditCellParams['rowNode'],
  colDef: {} as GridRenderEditCellParams['colDef'],
  cellMode: 'edit',
  isEditable: true,
  tabIndex: 0,
  hasFocus: true,
} as GridRenderEditCellParams;

describe('planting plan raw input edit cells', () => {
  beforeEach(() => {
    gridApiMock.setEditCellValue.mockClear();
  });

  it('keeps an empty area input while editing instead of restoring the fallback value', () => {
    const { rerender } = render(
      <AreaM2EditCell
        {...baseEditParams}
        field="area_m2"
        value={0}
        fallbackValue={0.5}
        locale="de-DE"
        maxKeyword="max"
        maxPlaceholder="max"
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('0');

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(gridApiMock.setEditCellValue).toHaveBeenLastCalledWith({
      id: 1,
      field: 'area_m2',
      value: '',
    });

    rerender(
      <AreaM2EditCell
        {...baseEditParams}
        field="area_m2"
        value=""
        fallbackValue={0.5}
        locale="de-DE"
        maxKeyword="max"
        maxPlaceholder="max"
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    expect(input.value).toBe('');
  });

  it('keeps localized decimal area drafts as raw text while editing', () => {
    render(
      <AreaM2EditCell
        {...baseEditParams}
        field="area_m2"
        value={0}
        fallbackValue={null}
        locale="de-DE"
        maxKeyword="max"
        maxPlaceholder="max"
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0,' } });
    expect(input.value).toBe('0,');
    expect(gridApiMock.setEditCellValue).toHaveBeenLastCalledWith({
      id: 1,
      field: 'area_m2',
      value: '0,',
    });

    fireEvent.change(input, { target: { value: '0,5' } });
    expect(input.value).toBe('0,5');
    expect(gridApiMock.setEditCellValue).toHaveBeenLastCalledWith({
      id: 1,
      field: 'area_m2',
      value: '0,5',
    });
  });

  it('keeps an empty plants input while editing', () => {
    render(
      <PlantsCountEditCell
        {...baseEditParams}
        field="plants_count"
        value={0}
        crops={[]}
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('0');

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(gridApiMock.setEditCellValue).toHaveBeenLastCalledWith({
      id: 1,
      field: 'plants_count',
      value: '',
    });
  });

  it('shows localized descriptive placeholders for empty raw inputs', () => {
    const { rerender } = render(
      <AreaM2EditCell
        {...baseEditParams}
        field="area_m2"
        value=""
        fallbackValue={null}
        locale="de-DE"
        maxKeyword="max"
        maxPlaceholder="max"
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('max')).toBeInTheDocument();

    rerender(
      <PlantsCountEditCell
        {...baseEditParams}
        field="plants_count"
        value=""
        crops={[]}
        placeholder="Anzahl eingeben"
        onLastEditedFieldChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Anzahl eingeben')).toBeInTheDocument();
  });
});
