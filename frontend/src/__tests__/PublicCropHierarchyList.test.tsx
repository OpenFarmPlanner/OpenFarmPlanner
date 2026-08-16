import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicCulture } from '../api/types';
import { PublicCropHierarchyList } from '../cultures/PublicCropHierarchyList';

const cultures: PublicCulture[] = [
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
    variety: 'Canadian Wonder2',
    crop_species_name: 'Bohne',
    version: 1,
    cultivation_type: 'direct_sowing',
    cultivation_types: ['direct_sowing'],
  },
];

describe('PublicCropHierarchyList', () => {
  it('shows variety rows without cultivation-type subtitles', async () => {
    render(
      <PublicCropHierarchyList
        cultures={cultures}
        selectedCultureId={2}
        isSpeciesView={false}
        onSelect={vi.fn()}
        ariaLabel="Crop library"
        searchQuery="bohne"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Bohne (Canadian Wonder2)' })).toBeInTheDocument();
    });

    expect(screen.getByText('Canadian Wonder2')).toBeInTheDocument();
    expect(screen.queryByText('Direktsaat')).not.toBeInTheDocument();
  });
});
