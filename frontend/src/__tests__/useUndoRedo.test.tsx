import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../hooks/useUndoRedo';

describe('useUndoRedo', () => {
  it('pushes, undoes and redoes commands', () => {
    const applied: Array<{ dir: string; value: unknown }> = [];

    const { result } = renderHook(() => useUndoRedo({
      applyCommand: (cmd, direction) => applied.push({ dir: direction, value: direction === 'undo' ? cmd.oldValue : cmd.newValue }),
    }));

    act(() => {
      result.current.pushCommand({
        entityType: 'crop',
        entityId: 1,
        fieldPath: 'name',
        oldValue: 'A',
        newValue: 'B',
        timestamp: Date.now(),
      });
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(applied).toEqual([
      { dir: 'undo', value: 'A' },
      { dir: 'redo', value: 'B' },
    ]);
  });
});
