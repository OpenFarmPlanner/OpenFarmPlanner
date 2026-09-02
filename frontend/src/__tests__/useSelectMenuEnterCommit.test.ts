import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSelectMenuEnterCommit } from '../components/data-grid/useSelectMenuEnterCommit';

interface TestOption {
  value: string | number;
  label: string;
}

const options: TestOption[] = [
  { value: 1, label: 'Direktsaat' },
  { value: 2, label: 'Vorkultur' },
];

function setup(overrides: Partial<Parameters<typeof useSelectMenuEnterCommit>[0]> = {}) {
  const setEditCellValue = vi.fn();
  const setOpen = vi.fn();
  const notifyMenuClose = vi.fn();
  const config = {
    open: true,
    options,
    api: { setEditCellValue },
    id: 7,
    field: 'cultivation_type',
    setOpen,
    notifyMenuClose,
    ...overrides,
  };
  const { result } = renderHook(() => useSelectMenuEnterCommit(config));
  return { result, setEditCellValue, setOpen, notifyMenuClose };
}

function makeMenuList(selectedValue: string): HTMLUListElement {
  const list = document.createElement('ul');
  const option = document.createElement('li');
  option.setAttribute('role', 'option');
  option.classList.add('Mui-selected');
  option.setAttribute('data-value', selectedValue);
  list.append(option);
  return list;
}

function makeReactKeyEvent(
  key: string,
  currentTarget: HTMLUListElement,
): ReactKeyboardEvent<HTMLUListElement> {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    nativeEvent: { stopImmediatePropagation: vi.fn() },
  } as unknown as ReactKeyboardEvent<HTMLUListElement>;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useSelectMenuEnterCommit — menu keydown handler', () => {
  it('commits the focused option on Enter', () => {
    const { result, setEditCellValue, setOpen, notifyMenuClose } = setup();
    const list = makeMenuList('2');
    const event = makeReactKeyEvent('Enter', list);

    result.current(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setEditCellValue).toHaveBeenCalledWith({ id: 7, field: 'cultivation_type', value: 2 });
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(notifyMenuClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Enter keys and modified Enter', () => {
    const { result, setEditCellValue } = setup();

    result.current(makeReactKeyEvent('a', makeMenuList('2')));
    const modified = makeReactKeyEvent('Enter', makeMenuList('2'));
    (modified as { ctrlKey: boolean }).ctrlKey = true;
    result.current(modified);

    expect(setEditCellValue).not.toHaveBeenCalled();
  });

  it('does nothing when no option value resolves', () => {
    const { result, setEditCellValue } = setup();
    const list = document.createElement('ul'); // no selected option

    result.current(makeReactKeyEvent('Enter', list));

    expect(setEditCellValue).not.toHaveBeenCalled();
  });
});

describe('useSelectMenuEnterCommit — document capture listener', () => {
  it('commits the focused option on a captured document Enter while open', () => {
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    option.classList.add('Mui-selected');
    option.setAttribute('data-value', '1');
    listbox.append(option);
    document.body.append(listbox);

    const { setEditCellValue, setOpen, notifyMenuClose } = setup({ open: true });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(setEditCellValue).toHaveBeenCalledWith({ id: 7, field: 'cultivation_type', value: 1 });
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(notifyMenuClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen while the menu is closed', () => {
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    option.classList.add('Mui-selected');
    option.setAttribute('data-value', '1');
    listbox.append(option);
    document.body.append(listbox);

    const { setEditCellValue } = setup({ open: false });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(setEditCellValue).not.toHaveBeenCalled();
  });
});
