import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '@mui/material';
import { DropdownAwareTooltip } from '../components/DropdownAwareTooltip';

describe('DropdownAwareTooltip', () => {
  it('hides immediately when a dropdown trigger is opened', async () => {
    render(
      <DropdownAwareTooltip title="Hilfetext" open>
        <Button role="combobox" aria-haspopup="listbox">
          Einheit
        </Button>
      </DropdownAwareTooltip>
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('Hilfetext');

    fireEvent.mouseDown(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('allows a normal field tooltip after a dropdown trigger had focus', async () => {
    render(
      <>
        <DropdownAwareTooltip title="Dropdown-Hilfe">
          <Button role="combobox" aria-haspopup="listbox">
            Einheit
          </Button>
        </DropdownAwareTooltip>
        <DropdownAwareTooltip title="Normale Hilfe">
          <Button>Normales Feld</Button>
        </DropdownAwareTooltip>
      </>
    );

    fireEvent.focusIn(screen.getByRole('combobox'));
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Normale Hilfe' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Normale Hilfe');
  });
});
