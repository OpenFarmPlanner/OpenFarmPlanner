import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Culture } from '../api/api';
import { CultureMobileSelectorDialog } from '../cultures/CultureMobileSelectorDialog';

const culture: Culture = {
  id: 58,
  name: 'Tomate',
  variety: 'Roma',
  crop_family: 'Nachtschatten',
  display_color: '',
};

describe('CultureMobileSelectorDialog', () => {
  beforeEach(() => {
    window.history.replaceState({ page: 'cultures' }, '', '/app/cultures?cultureId=58');
  });

  it('closes from browser back without changing the current route', async () => {
    const onClose = vi.fn();

    render(
      <CultureMobileSelectorDialog
        open
        onClose={onClose}
        selectorControl={<div />}
        cultures={[culture]}
        selectedCultureId={culture.id}
        onSelect={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(window.history.state).toMatchObject({
      openFarmPlannerCultureSelector: expect.any(String),
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/app/cultures');
      expect(window.location.search).toBe('?cultureId=58');
    });
  });
});
