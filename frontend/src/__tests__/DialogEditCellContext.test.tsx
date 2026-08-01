import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDialogEditCellKey,
  DialogEditCellContext,
  useDialogEditCellOpenRequest,
  type DialogEditCellRequest,
} from '../components/data-grid/DialogEditCellContext';

function Probe({ rowId, field, onOpen }: { rowId?: string | number; field?: string; onOpen: () => void }) {
  const [renderCount, setRenderCount] = useState(0);
  useDialogEditCellOpenRequest(rowId, field, onOpen);

  return (
    <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
      rerender {renderCount}
    </button>
  );
}

const renderProbe = (
  request: DialogEditCellRequest | null,
  cell: { rowId?: string | number; field?: string } = { rowId: 7, field: 'bed' },
) => {
  const onOpen = vi.fn();
  const consumeRequest = vi.fn();
  const view = render(
    <DialogEditCellContext.Provider value={{ request, consumeRequest }}>
      <Probe rowId={cell.rowId} field={cell.field} onOpen={onOpen} />
    </DialogEditCellContext.Provider>,
  );

  const rerenderWith = (
    nextRequest: DialogEditCellRequest | null,
    nextConsumeRequest: (token: number) => void = consumeRequest,
  ): void => {
    view.rerender(
      <DialogEditCellContext.Provider value={{ request: nextRequest, consumeRequest: nextConsumeRequest }}>
        <Probe rowId={cell.rowId} field={cell.field} onOpen={onOpen} />
      </DialogEditCellContext.Provider>,
    );
  };

  return { consumeRequest, onOpen, rerenderWith };
};

describe('useDialogEditCellOpenRequest', () => {
  it('builds a stable key from the cell identity', () => {
    expect(buildDialogEditCellKey(7, 'bed')).toBe('7:bed');
    expect(buildDialogEditCellKey('7', 'bed')).toBe('7:bed');
  });

  it('opens once per request token and consumes the request', () => {
    const { consumeRequest, onOpen } = renderProbe({ cellKey: '7:bed', token: 1 });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(consumeRequest).toHaveBeenCalledWith(1);
  });

  it('does not open again while the same token is still pending', async () => {
    const user = userEvent.setup();
    const { onOpen, rerenderWith } = renderProbe({ cellKey: '7:bed', token: 1 });

    // Re-renders of the cell and of the provider must not replay the entry —
    // a second open would reset a draft the user is already editing.
    await user.click(screen.getByRole('button'));
    act(() => rerenderWith({ cellKey: '7:bed', token: 1 }));
    // Even a fresh consumer identity re-running the effect must not reopen.
    act(() => rerenderWith({ cellKey: '7:bed', token: 1 }, vi.fn()));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens again for a new token on the same cell', () => {
    const { onOpen, rerenderWith } = renderProbe({ cellKey: '7:bed', token: 1 });

    act(() => rerenderWith(null));
    act(() => rerenderWith({ cellKey: '7:bed', token: 2 }));

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('ignores requests aimed at another cell', () => {
    const { consumeRequest, onOpen } = renderProbe({ cellKey: '8:bed', token: 1 });

    expect(onOpen).not.toHaveBeenCalled();
    expect(consumeRequest).not.toHaveBeenCalled();
  });

  it('ignores requests when the cell has no identity', () => {
    const { onOpen } = renderProbe({ cellKey: 'undefined:undefined', token: 1 }, {});

    expect(onOpen).not.toHaveBeenCalled();
  });
});
