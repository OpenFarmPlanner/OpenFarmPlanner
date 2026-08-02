import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

export interface SelectEditCellOpenRequest {
  cellKey: string;
  token: number;
}

export interface SelectEditCellContextValue {
  request: SelectEditCellOpenRequest | null;
  consumeRequest: (token: number) => void;
  onMenuClose?: (rowId: GridRowId, field: string, event: unknown) => void;
}

export const buildSelectEditCellKey = (rowId: GridRowId, field: string): string =>
  `${String(rowId)}:${field}`;

export const SelectEditCellContext = createContext<SelectEditCellContextValue | null>(null);

export function useSelectEditCellOpenRequest(
  rowId: GridRowId | undefined,
  field: string | undefined,
  onOpenRequested: () => void,
): (event: unknown) => void {
  const context = useContext(SelectEditCellContext);
  const onOpenRequestedRef = useRef(onOpenRequested);
  const handledTokenRef = useRef<number | null>(null);

  useEffect(() => {
    onOpenRequestedRef.current = onOpenRequested;
  }, [onOpenRequested]);

  const request = context?.request ?? null;
  const consumeRequest = context?.consumeRequest;
  const cellKey = rowId === undefined || field === undefined
    ? null
    : buildSelectEditCellKey(rowId, field);
  const pendingToken = request && cellKey !== null && request.cellKey === cellKey
    ? request.token
    : null;

  useEffect(() => {
    if (pendingToken === null || handledTokenRef.current === pendingToken) {
      return;
    }

    handledTokenRef.current = pendingToken;
    consumeRequest?.(pendingToken);
    onOpenRequestedRef.current();
  }, [consumeRequest, pendingToken]);

  return useCallback((event: unknown): void => {
    if (rowId === undefined || field === undefined) {
      return;
    }

    context?.onMenuClose?.(rowId, field, event);
  }, [context, field, rowId]);
}
