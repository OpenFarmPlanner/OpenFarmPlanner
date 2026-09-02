import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PublicCrop } from '../api/types';
import { PublicCropMobileSelectorDialog } from '../crop-library/components/publicCropLibrary/PublicCropMobileSelectorDialog';

const crops: PublicCrop[] = [
  {
    id: 1,
    status: 'published',
    name: 'Bohne',
    variety: '',
    crop_species_name: 'Bohne',
    version: 1,
    cultivation_type: 'pre_cultivation',
    cultivation_types: ['pre_cultivation'],
  },
  {
    id: 2,
    status: 'published',
    name: 'Bohne',
    variety: 'Canadian Wonder',
    crop_species_name: 'Bohne',
    version: 1,
    cultivation_type: 'direct_sowing',
    cultivation_types: ['direct_sowing'],
  },
];

function pixelValue(element: Element, property: 'minHeight' | 'width' | 'height'): number {
  return Number.parseFloat(window.getComputedStyle(element)[property] || '0');
}

describe('PublicCropMobileSelectorDialog', () => {
  it('gives every row and the expand toggle a mobile-sized touch target', async () => {
    render(
      <PublicCropMobileSelectorDialog
        open
        query=""
        crops={crops}
        loading={false}
        error=""
        selectedCropId={2}
        listRef={vi.fn()}
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSearchSubmit={vi.fn()}
        onSelect={vi.fn()}
        onListScroll={vi.fn()}
      />,
    );

    const rows = await screen.findAllByRole('option');
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((row) => {
      expect(pixelValue(row, 'minHeight')).toBeGreaterThanOrEqual(48);
    });

    const toggles = screen.getAllByRole('button', { name: /aufklappen|zuklappen|expand|collapse/i });
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((toggle) => {
      expect(pixelValue(toggle, 'width')).toBeGreaterThanOrEqual(44);
      expect(pixelValue(toggle, 'height')).toBeGreaterThanOrEqual(44);
    });
  });
});
