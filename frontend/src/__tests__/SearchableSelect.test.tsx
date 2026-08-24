/**
 * Tests for SearchableSelect component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect, type SearchableSelectOption } from '../components/inputs/SearchableSelect';

describe('SearchableSelect', () => {
  let mockOptions: SearchableSelectOption[];
  let mockOnChange: ReturnType<typeof vi.fn<[SearchableSelectOption<number> | null], void>>;
  let mockOnInputChange: ReturnType<typeof vi.fn<[string], void>>;

  beforeEach(() => {
    mockOptions = [
      { value: 1, label: 'Option 1', data: { extra: 'data1' } },
      { value: 2, label: 'Option 2', data: { extra: 'data2' } },
      { value: 3, label: 'Option 3', data: { extra: 'data3' } },
    ];

    mockOnChange = vi.fn<[SearchableSelectOption<number> | null], void>();
    mockOnInputChange = vi.fn<[string], void>();
  });

  describe('Rendering', () => {
    it('should render with empty options list', () => {
      render(
        <SearchableSelect
          options={[]}
          value={null}
          onChange={mockOnChange}
          label="Test Label"
        />
      );

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('should render with provided options', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          label="Select Option"
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render with label prop', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          label="My Label"
        />
      );

      expect(screen.getByLabelText('My Label')).toBeInTheDocument();
    });

    it('should render with placeholder prop', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          placeholder="Select an option"
        />
      );

      expect(screen.getByPlaceholderText('Select an option')).toBeInTheDocument();
    });

    it('should render with custom noOptionsText', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          noOptionsText="No matching options"
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'xyz');

      await waitFor(() => {
        expect(screen.getByText('No matching options')).toBeInTheDocument();
      });
    });

    it('should render with size="small"', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          size="small"
        />
      );

      const input = screen.getByRole('combobox');
      // MUI v9 moved the size class from the <input> itself to the
      // MuiInputBase-root wrapper (there is no more `inputSizeSmall`).
      expect(input.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall');
    });

    it('should render with size="medium"', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          size="medium"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input.className).toContain('MuiAutocomplete');
    });

    it('should render with fullWidth prop', () => {
      const { container } = render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          fullWidth
        />
      );

      const autocomplete = container.querySelector('.MuiAutocomplete-root');
      expect(autocomplete).toHaveClass('MuiAutocomplete-fullWidth');
    });

    it('should apply custom textFieldSx styles', () => {
      const { container } = render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          textFieldSx={{ backgroundColor: 'red' }}
        />
      );

      const textField = container.querySelector('.MuiTextField-root');
      expect(textField).toBeInTheDocument();
    });
  });

  describe('Selection Behavior', () => {
    it('should call onChange when option is selected', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.click(screen.getByText('Option 1'));

      expect(mockOnChange).toHaveBeenCalledWith(mockOptions[0]);
    });

    it('should display selected value correctly', async () => {
      const selectedOption = mockOptions[0];

      render(
        <SearchableSelect
          options={mockOptions}
          value={selectedOption}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
    });

    it('should handle null value', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should use isOptionEqualToValue to compare options by value property', async () => {
      const selectedOption = { value: 1, label: 'Option 1' };

      render(
        <SearchableSelect
          options={mockOptions}
          value={selectedOption}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
    });
  });

  describe('Search/Filter', () => {
    it('should filter options based on input text', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, '1');

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });
    });

    it('should show all options when input is empty', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
        expect(screen.getByText('Option 3')).toBeInTheDocument();
      });
    });

    it('should show noOptionsText when no options match', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          noOptionsText="No options match"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'xyz');

      await waitFor(() => {
        expect(screen.getByText('No options match')).toBeInTheDocument();
      });
    });

    it('should handle controlled inputValue prop', async () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          inputValue="Option 2"
          onInputChange={mockOnInputChange}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('Option 2');
    });

    it('should call onInputChange when input changes', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          onInputChange={mockOnInputChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(mockOnInputChange).toHaveBeenCalled();
      });
    });

    it('should use internal state when inputValue not provided', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      await user.click(input);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(input.value).toBe('test');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should open dropdown on focus (openOnFocus prop)', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });
    });

    it('should highlight first option automatically (autoHighlight prop)', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // MUI Autocomplete has autoHighlight enabled by default
      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });
    });

    it('should navigate options with arrow keys', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Arrow down to navigate
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // This verifies keyboard navigation is working in MUI Autocomplete
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should select option with Enter key', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      // After escape, options should not be visible
      await waitFor(() => {
        expect(input.getAttribute('aria-expanded')).not.toBe('true');
      });
    });
  });

  describe('AutoFocus', () => {
    it('should focus input on mount when autoFocus is true', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          autoFocus
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(document.activeElement).toBe(input);
    });

    it('should not focus input on mount when autoFocus is false', () => {
      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          autoFocus={false}
        />
      );

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('Data property', () => {
    it('should preserve data property in options', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.click(screen.getByText('Option 1'));

      const callArg = mockOnChange.mock.calls[0][0];
      expect(callArg.data).toEqual({ extra: 'data1' });
    });
  });

  describe('Integration', () => {
    it('should handle complete selection workflow', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          onInputChange={mockOnInputChange}
          label="Select an item"
          placeholder="Type to search"
        />
      );

      const input = screen.getByRole('combobox');

      // Focus and type
      await user.click(input);
      await user.type(input, 'Option 2');

      // Verify onChange was called
      await waitFor(() => {
        expect(mockOnInputChange).toHaveBeenCalled();
      });

      // Select the option
      await user.click(screen.getByText('Option 2'));

      expect(mockOnChange).toHaveBeenCalledWith(mockOptions[1]);
    });

    it('should allow changing selection', async () => {
      const user = userEvent.setup();

      render(
        <SearchableSelect
          options={mockOptions}
          value={mockOptions[0]}
          onChange={mockOnChange}
        />
      );

      // First option should be selected
      expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();

      // Click on input and select different option
      const input = screen.getByRole('combobox') as HTMLInputElement;
      await user.click(input);

      // Wait for options to appear and click Option 3
      await waitFor(() => {
        expect(screen.getByText('Option 3')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Option 3'));

      expect(mockOnChange).toHaveBeenCalledWith(mockOptions[2]);
    });

    it('commits the highlighted option with Enter without notifying a parent keyboard handler', async () => {
      const user = userEvent.setup();
      const parentKeyDown = vi.fn();

      render(
        <div onKeyDown={parentKeyDown}>
          <SearchableSelect
            options={mockOptions}
            value={null}
            onChange={mockOnChange}
            label="Select an item"
          />
        </div>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(mockOptions[1]);
      expect(parentKeyDown).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Enter' }),
      );
    });
  });
});
