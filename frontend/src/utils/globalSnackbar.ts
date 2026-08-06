export const GLOBAL_SNACKBAR_EVENT = 'ofp:show-snackbar';

export type GlobalSnackbarSeverity = 'success' | 'error' | 'info';

export interface GlobalSnackbarDetail {
  message: string;
  severity?: GlobalSnackbarSeverity;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export function showGlobalSnackbar(detail: GlobalSnackbarDetail): void {
  window.dispatchEvent(new CustomEvent<GlobalSnackbarDetail>(GLOBAL_SNACKBAR_EVENT, { detail }));
}
