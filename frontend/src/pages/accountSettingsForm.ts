// Non-component form helpers for the account settings page: the shared action
// button width style and the per-section submit-state hook.

import { useState } from 'react';

export const actionButtonSx = { width: { xs: '100%', sm: 'auto' } } as const;

export interface SectionSubmit {
  message: string | null;
  error: string | null;
  submitting: boolean;
  submit: (action: () => Promise<{ detail: string }>, onSuccess?: () => void | Promise<void>) => Promise<void>;
  clearError: () => void;
}

export function useSectionSubmit(genericErrorMessage: string): SectionSubmit {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (
    action: () => Promise<{ detail: string }>,
    onSuccess?: () => void | Promise<void>,
  ): Promise<void> => {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await action();
      setMessage(response.detail);
      await onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : genericErrorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return { message, error, submitting, submit, clearError: () => setError(null) };
}
