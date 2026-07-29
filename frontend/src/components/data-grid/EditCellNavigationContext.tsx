import { createContext, useContext } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

export interface EditCellKeyboardEvent {
  altKey?: boolean;
  ctrlKey?: boolean;
  defaultMuiPrevented?: boolean;
  key: string;
  metaKey?: boolean;
  nativeEvent: {
    isComposing?: boolean;
    stopImmediatePropagation?: () => void;
  };
  preventDefault: () => void;
  shiftKey?: boolean;
  stopPropagation: () => void;
}

interface EditCellTabNavigationRequest {
  id: GridRowId;
  field: string;
  event: EditCellKeyboardEvent;
}

export type EditCellTabNavigationHandler = (request: EditCellTabNavigationRequest) => boolean;

export const EditCellNavigationContext = createContext<EditCellTabNavigationHandler | null>(null);

export const useEditCellNavigation = (): EditCellTabNavigationHandler | null =>
  useContext(EditCellNavigationContext);
