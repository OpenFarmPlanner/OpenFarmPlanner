import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Crop } from '../api/api';
import { CropMobileSelectorDialog } from '../crops/CropMobileSelectorDialog';

const crop: Crop = {
  id: 58,
  name: 'Tomate',
  variety: 'Roma',
  crop_family: 'Nachtschatten',
  display_color: '',
};

const secondVariety: Crop = {
  id: 59,
  name: 'Tomate',
  variety: 'Cherry',
  crop_family: 'Nachtschatten',
  display_color: '',
};

function pixelValue(element: Element, property: 'minHeight' | 'width' | 'height'): number {
  return Number.parseFloat(window.getComputedStyle(element)[property] || '0');
}

describe('CropMobileSelectorDialog', () => {
  beforeEach(() => {
    window.history.replaceState({ page: 'crops' }, '', '/app/crops?cropId=58');
  });

  it('closes from browser back without changing the current route', async () => {
    const onClose = vi.fn();

    render(
      <CropMobileSelectorDialog
        open
        onClose={onClose}
        selectorControl={<div />}
        crops={[crop]}
        selectedCropId={crop.id}
        onSelect={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(window.history.state).toMatchObject({
      openFarmPlannerCropSelector: expect.any(String),
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/app/crops');
      expect(window.location.search).toBe('?cropId=58');
    });
  });

  it('gives every row and the expand toggle a mobile-sized touch target', async () => {
    render(
      <CropMobileSelectorDialog
        open
        onClose={vi.fn()}
        selectorControl={<div />}
        crops={[crop, secondVariety]}
        selectedCropId={crop.id}
        onSelect={vi.fn()}
        t={((key: string) => key) as never}
      />,
    );

    const rows = await screen.findAllByRole('option');
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((row) => {
      expect(pixelValue(row, 'minHeight')).toBeGreaterThanOrEqual(48);
    });

    const toggle = screen.getByRole('button', { name: /hierarchy\.(expand|collapse)Crop/ });
    expect(pixelValue(toggle, 'width')).toBeGreaterThanOrEqual(44);
    expect(pixelValue(toggle, 'height')).toBeGreaterThanOrEqual(44);
  });
});
