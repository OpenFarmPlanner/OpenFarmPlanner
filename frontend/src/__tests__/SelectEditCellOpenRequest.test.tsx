import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectEditCellKey,
  SelectEditCellContext,
  useSelectEditCellOpenRequest,
  type SelectEditCellContextValue,
} from '../components/data-grid/SelectEditCellContext';
import {
  isSelectEditMenuCloseOutsideElement,
  isSelectEditMenuEscapeClose,
  isSelectEditMenuInternalCloseTarget,
} from '../components/data-grid/selectEditMenuClose';
import { StandardSingleSelectEditCell } from '../components/data-grid/StandardSingleSelectEditCell';
import { CultivationTypeEditCell } from '../pages/CultivationTypeEditCell';

const createEditCellParams = (
  overrides: Partial<GridRenderEditCellParams> = {},
): GridRenderEditCellParams => ({
  id: 1,
  field: 'crop',
  value: 1,
  hasFocus: true,
  api: { setEditCellValue: vi.fn() },
  ...overrides,
} as unknown as GridRenderEditCellParams);

function renderWithSelectOpenRequest(
  cellKey: string,
  children: ReactNode,
  onMenuClose?: SelectEditCellContextValue['onMenuClose'],
): { consumeRequest: ReturnType<typeof vi.fn> } {
  const consumeRequest = vi.fn();
  const contextValue: SelectEditCellContextValue = {
    request: { cellKey, token: 1 },
    consumeRequest,
    onMenuClose,
  };

  render(
    <SelectEditCellContext.Provider value={contextValue}>
      {children}
    </SelectEditCellContext.Provider>,
  );

  return { consumeRequest };
}

function SelectCloseProbe() {
  const notifyMenuClose = useSelectEditCellOpenRequest(1, 'crop', () => {});

  return (
    <button type="button" onClick={(event) => notifyMenuClose(event)}>
      close
    </button>
  );
}

const setElementRect = (
  element: HTMLElement,
  rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>,
): void => {
  element.getBoundingClientRect = vi.fn(() => ({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  } as DOMRect));
};

describe('select edit cell open requests', () => {
  it('opens the shared single-select edit cell when requested', async () => {
    const params = createEditCellParams();
    const { consumeRequest } = renderWithSelectOpenRequest(
      buildSelectEditCellKey(params.id, params.field),
      <StandardSingleSelectEditCell
        {...params}
        options={[
          { value: 1, label: 'Kohl' },
          { value: 2, label: 'Bohne' },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByRole('combobox', { hidden: true })).toHaveAttribute('aria-expanded', 'true'));
    expect(await screen.findByRole('option', { name: 'Bohne', hidden: true })).toBeVisible();
    expect(consumeRequest).toHaveBeenCalledWith(1);
  });

  it('opens the cultivation-type edit cell when requested', async () => {
    const params = createEditCellParams({
      field: 'cultivation_type',
      value: 'direct_sowing',
    });
    const { consumeRequest } = renderWithSelectOpenRequest(
      buildSelectEditCellKey(params.id, params.field),
      <CultivationTypeEditCell
        {...params}
        options={[
          { value: 'direct_sowing', label: 'Direktsaat' },
          { value: 'transplanting', label: 'Vorkultur' },
        ]}
        placeholder="Kulturtyp wählen"
      />,
    );

    await waitFor(() => expect(screen.getByRole('combobox', { hidden: true })).toHaveAttribute('aria-expanded', 'true'));
    expect(await screen.findByRole('option', { name: 'Vorkultur', hidden: true })).toBeVisible();
    expect(consumeRequest).toHaveBeenCalledWith(1);
  });

  it('notifies the grid when a select edit menu closes', () => {
    const onMenuClose = vi.fn();
    renderWithSelectOpenRequest(
      buildSelectEditCellKey(1, 'crop'),
      <SelectCloseProbe />,
      onMenuClose,
    );

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onMenuClose).toHaveBeenCalledWith(1, 'crop', expect.anything());
  });

  it('keeps option/listbox closes internal to the select menu', () => {
    const listbox = document.createElement('ul');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('li');
    option.setAttribute('role', 'option');
    listbox.append(option);

    expect(isSelectEditMenuInternalCloseTarget({ target: option })).toBe(true);
  });

  it('detects whether a select backdrop click landed outside the edited row', () => {
    const row = document.createElement('div');
    setElementRect(row, {
      left: 10,
      top: 20,
      right: 210,
      bottom: 50,
      width: 200,
      height: 30,
    });
    const backdrop = document.createElement('div');

    expect(isSelectEditMenuCloseOutsideElement({
      target: backdrop,
      nativeEvent: new MouseEvent('click', { clientX: 100, clientY: 35 }),
    }, row)).toBe(false);
    expect(isSelectEditMenuCloseOutsideElement({
      target: backdrop,
      nativeEvent: new MouseEvent('click', { clientX: 100, clientY: 80 }),
    }, row)).toBe(true);
  });

  it('does not treat keyboard-style closes without coordinates as outside the row', () => {
    const row = document.createElement('div');
    setElementRect(row, {
      left: 10,
      top: 20,
      right: 210,
      bottom: 50,
      width: 200,
      height: 30,
    });

    expect(isSelectEditMenuCloseOutsideElement({ target: document.body }, row)).toBe(false);
  });

  it('detects Escape closes from synthetic and native select events', () => {
    expect(isSelectEditMenuEscapeClose({ key: 'Escape' })).toBe(true);
    expect(isSelectEditMenuEscapeClose({ nativeEvent: new KeyboardEvent('keydown', { key: 'Escape' }) })).toBe(true);
    expect(isSelectEditMenuEscapeClose({ key: 'Enter' })).toBe(false);
  });
});
