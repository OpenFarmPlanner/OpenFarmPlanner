import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { FormControl, InputLabel, MenuItem } from '@mui/material';
import { useState } from 'react';
import { TypeaheadSelect } from '../components/inputs/TypeaheadSelect';

interface TestOption {
  value: string;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
}

interface SelectHarnessProps {
  options?: TestOption[];
  initialValue?: string;
  onChange?: (value: string) => void;
}

const defaultOptions: TestOption[] = [
  { value: '', label: 'Alle' },
  { value: 'low', label: 'Niedrig' },
  { value: 'corn', label: 'Mais' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'localized', label: 'Ölrettich' },
];

function SelectHarness({
  options = defaultOptions,
  initialValue = '',
  onChange,
}: SelectHarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <FormControl fullWidth>
      <InputLabel id="priority-label">Priorität</InputLabel>
      <TypeaheadSelect
        labelId="priority-label"
        label="Priorität"
        value={value}
        onChange={(event) => {
          const nextValue = String(event.target.value);
          setValue(nextValue);
          onChange?.(nextValue);
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            hidden={option.hidden}
          >
            {option.label}
          </MenuItem>
        ))}
      </TypeaheadSelect>
    </FormControl>
  );
}

describe('TypeaheadSelect', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects a matching option from a single typed character while closed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SelectHarness onChange={onChange} />);

    const select = screen.getByRole('combobox');
    await user.tab();
    expect(select).toHaveFocus();

    await user.keyboard('h');

    expect(select).toHaveTextContent('Hoch');
    expect(onChange).toHaveBeenLastCalledWith('high');
  });

  it('keeps immediately typed characters as one search term', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    await user.tab();
    await user.keyboard('mi');

    expect(screen.getByRole('combobox')).toHaveTextContent('Mittel');
  });

  it('resets the search buffer after the timeout', () => {
    vi.useFakeTimers();
    render(<SelectHarness />);

    const select = screen.getByRole('combobox');
    act(() => {
      select.focus();
    });

    act(() => {
      fireEvent.keyDown(select, { key: 'm' });
    });
    expect(select).toHaveTextContent('Mais');

    act(() => {
      vi.advanceTimersByTime(701);
    });
    act(() => {
      fireEvent.keyDown(select, { key: 'i' });
    });

    expect(select).toHaveTextContent('Mais');
  });

  it('matches labels case-insensitively', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    await user.tab();
    await user.keyboard('HO');

    expect(screen.getByRole('combobox')).toHaveTextContent('Hoch');
  });

  it('matches localized visible labels', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    await user.tab();
    await user.keyboard('öl');

    expect(screen.getByRole('combobox')).toHaveTextContent('Ölrettich');
  });

  it('leaves the current value unchanged when no option matches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SelectHarness initialValue="low" onChange={onChange} />);

    await user.tab();
    await user.keyboard('x');

    expect(screen.getByRole('combobox')).toHaveTextContent('Niedrig');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not replace MUI typeahead while the dropdown is open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SelectHarness initialValue="low" onChange={onChange} />);

    const select = screen.getByRole('combobox');
    await user.click(select);

    const listbox = await screen.findByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'm' });

    expect(select).toHaveAttribute('aria-expanded', 'true');
    expect(select).toHaveTextContent('Niedrig');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('skips disabled and hidden options when searching', async () => {
    const user = userEvent.setup();
    render(
      <SelectHarness
        options={[
          { value: '', label: 'Alle' },
          { value: 'disabled', label: 'Mittel', disabled: true },
          { value: 'hidden', label: 'Minze versteckt', hidden: true },
          { value: 'enabled', label: 'Minze' },
        ]}
      />,
    );

    await user.tab();
    await user.keyboard('mi');

    expect(screen.getByRole('combobox')).toHaveTextContent('Minze');
    expect(within(screen.getByRole('combobox')).queryByText('Mittel')).not.toBeInTheDocument();
  });

  describe('Tab out of an open dropdown', () => {
    it('takes over the highlighted option, closes the menu and moves on', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form>
          <SelectHarness initialValue="low" onChange={onChange} />
          <button type="button">Weiter</button>
        </form>,
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('{ArrowDown}');
      await user.tab();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith('corn');
      expect(screen.getByRole('combobox')).toHaveTextContent('Mais');
      expect(screen.getByRole('button', { name: 'Weiter' })).toHaveFocus();
    });

    it('moves to the previous field on Shift+Tab', async () => {
      const user = userEvent.setup();
      render(
        <form>
          <button type="button">Zurück</button>
          <SelectHarness initialValue="low" />
        </form>,
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zurück' })).toHaveFocus();
    });

    it('does not toggle the highlighted option of a multi-select', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <FormControl fullWidth>
          <InputLabel id="crops-label">Kulturen</InputLabel>
          <TypeaheadSelect<string[]>
            multiple
            labelId="crops-label"
            label="Kulturen"
            value={[]}
            onChange={onChange}
          >
            <MenuItem value="low">Niedrig</MenuItem>
            <MenuItem value="corn">Mais</MenuItem>
          </TypeaheadSelect>
        </FormControl>,
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('{ArrowDown}');
      await user.tab();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps focus on the trigger when there is no field to move to', async () => {
      const user = userEvent.setup();
      render(<SelectHarness initialValue="low" />);

      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.tab();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(select).toHaveFocus();
    });
  });
});
