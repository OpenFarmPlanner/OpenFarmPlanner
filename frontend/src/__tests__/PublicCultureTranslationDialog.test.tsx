import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCultureTranslationDialog } from '../crops/components/PublicCultureTranslationDialog';
import type { PublicCulture } from '../api/types';

// The suite is pinned to German UI chrome (setupTests.ts); the `language`
// prop below is the translation being edited, independent of that.

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  updateTranslations: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      getTranslations: mocks.getTranslations,
      updateTranslations: mocks.updateTranslations,
    },
  };
});

const culture: PublicCulture = {
  id: 1,
  status: 'published',
  name: 'Tomate',
  variety: 'Roma',
  notes: 'Robuste Sorte.',
  version: 1,
};

describe('PublicCultureTranslationDialog', () => {
  beforeEach(() => {
    mocks.getTranslations.mockReset();
    mocks.updateTranslations.mockReset();
  });

  it('leaves the editor empty when the edited language has no translation yet, and shows the German original read-only', async () => {
    mocks.getTranslations.mockResolvedValue({
      data: {
        original_language_code: 'de',
        translations: { de: 'Robuste Sorte.' },
      },
    });

    render(
      <PublicCultureTranslationDialog
        open
        culture={culture}
        language="en"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.getTranslations).toHaveBeenCalledWith(1));

    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue('');
    expect(screen.getByText('Robuste Sorte.')).toBeInTheDocument();
  });

  it('loads an existing English translation into the editor', async () => {
    mocks.getTranslations.mockResolvedValue({
      data: {
        original_language_code: 'de',
        translations: { de: 'Robuste Sorte.', en: 'A robust variety.' },
      },
    });

    render(
      <PublicCultureTranslationDialog
        open
        culture={culture}
        language="en"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const textarea = await screen.findByRole('textbox');
    await waitFor(() => expect(textarea).toHaveValue('A robust variety.'));
  });

  it('hides the read-only original section once an English translation exists', async () => {
    mocks.getTranslations.mockResolvedValue({
      data: {
        original_language_code: 'de',
        translations: { de: 'Robuste Sorte.', en: 'A robust variety.' },
      },
    });

    render(
      <PublicCultureTranslationDialog
        open
        culture={culture}
        language="en"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await screen.findByRole('textbox');
    expect(screen.queryByText('Robuste Sorte.')).not.toBeInTheDocument();
  });

  it('saves only the English translation, leaving German untouched', async () => {
    mocks.getTranslations.mockResolvedValue({
      data: {
        original_language_code: 'de',
        translations: { de: 'Robuste Sorte.' },
      },
    });
    mocks.updateTranslations.mockResolvedValue({
      data: { original_language_code: 'de', translations: { de: 'Robuste Sorte.', en: 'A robust variety.' } },
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <PublicCultureTranslationDialog
        open
        culture={culture}
        language="en"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'A robust variety.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(mocks.updateTranslations).toHaveBeenCalledWith(1, { en: 'A robust variety.' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('saves only the German translation, leaving English untouched', async () => {
    mocks.getTranslations.mockResolvedValue({
      data: {
        original_language_code: 'de',
        translations: { de: 'Robuste Sorte.', en: 'A robust variety.' },
      },
    });
    mocks.updateTranslations.mockResolvedValue({
      data: { original_language_code: 'de', translations: { de: 'Sehr robuste Sorte.', en: 'A robust variety.' } },
    });
    const user = userEvent.setup();

    render(
      <PublicCultureTranslationDialog
        open
        culture={culture}
        language="de"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const textarea = await screen.findByRole('textbox');
    await waitFor(() => expect(textarea).toHaveValue('Robuste Sorte.'));
    await user.clear(textarea);
    await user.type(textarea, 'Sehr robuste Sorte.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(mocks.updateTranslations).toHaveBeenCalledWith(1, { de: 'Sehr robuste Sorte.' }));
  });
});
