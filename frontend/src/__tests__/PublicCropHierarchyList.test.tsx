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

  it('shows only the pending-suggestion icon for a species with a single pending variety', async () => {
    const pendingCultures: PublicCulture[] = [{
      id: 3,
      status: 'published',
      name: 'Kürbis',
      variety: 'Hokkaido',
      crop_species_name: 'Kürbis',
      crop_species_status: 'proposed',
      version: 1,
      cultivation_type: 'direct_sowing',
      cultivation_types: ['direct_sowing'],
    }];

    render(
      <PublicCropHierarchyList
        cultures={pendingCultures}
        selectedCultureId={null}
        isSpeciesView
        onSelect={vi.fn()}
        ariaLabel="Crop library"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Kürbis' })).toBeInTheDocument();
    });

    expect(screen.queryByText('(1)')).not.toBeInTheDocument();
  });

  it('shows the pending-suggestion icon alongside the count once more than one variety is proposed', async () => {
    const pendingCultures: PublicCulture[] = [
      {
        id: 4,
        status: 'published',
        name: 'Kürbis',
        variety: 'Hokkaido',
        crop_species_name: 'Kürbis',
        crop_species_status: 'proposed',
        version: 1,
        cultivation_type: 'direct_sowing',
        cultivation_types: ['direct_sowing'],
      },
      {
        id: 5,
        status: 'published',
        name: 'Kürbis',
        variety: 'Butternut',
        crop_species_name: 'Kürbis',
        crop_species_status: 'proposed',
        version: 1,
        cultivation_type: 'direct_sowing',
        cultivation_types: ['direct_sowing'],
      },
    ];

    render(
      <PublicCropHierarchyList
        cultures={pendingCultures}
        selectedCultureId={null}
        isSpeciesView
        onSelect={vi.fn()}
        ariaLabel="Crop library"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Kürbis' })).toBeInTheDocument();
    });

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });
});
