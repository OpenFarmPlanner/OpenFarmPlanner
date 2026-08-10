import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationDialog } from '../ConfirmationDialog';
import theme from '../../../theme';

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmationDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <ConfirmationDialog
        open
        title="Kultur löschen?"
        message="Diese Aktion kann nicht rückgängig gemacht werden."
        cancelLabel="Abbrechen"
        confirmLabel="Löschen"
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmButtonProps={{ color: 'error', variant: 'contained' }}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onCancel, onConfirm };
}

describe('ConfirmationDialog — destructive-action keyboard safety', () => {
  it('focuses the cancel button by default, not the destructive confirm button', async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    });
  });

  it('triggers cancel, never confirm, when Enter is pressed right after opening', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    });
    await user.keyboard('{Enter}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes via cancel when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('only triggers the destructive action when the confirm button is explicitly focused and activated', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Löschen' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('ignores an autoFocus passed via confirmButtonProps to prevent accidental misuse', async () => {
    renderDialog({ confirmButtonProps: { color: 'error', variant: 'contained', autoFocus: true } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    });
    expect(screen.getByRole('button', { name: 'Löschen' })).not.toHaveFocus();
  });
});
