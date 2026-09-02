import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicCrop } from '../api/types';
import { PublicCropHierarchyList } from '../crops/PublicCropHierarchyList';

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
        crops={crops}
        selectedCropId={2}
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

  it('shows all varieties in a matched crop group and highlights the search text', async () => {
    render(
      <PublicCropHierarchyList
        crops={[
          {
            id: 10,
            status: 'published',
            name: 'Tomate',
            variety: '',
            crop_species_name: 'Tomate',
            version: 1,
          },
          {
            id: 11,
            status: 'published',
            name: 'Tomate',
            variety: 'Roma',
            crop_species_name: 'Tomate',
            version: 1,
          },
          {
            id: 12,
            status: 'published',
            name: 'Tomate',
            variety: 'Cherry',
            crop_species_name: 'Tomate',
            version: 1,
          },
        ]}
        selectedCropId={11}
        isSpeciesView={false}
        onSelect={vi.fn()}
        ariaLabel="Crop library"
        searchQuery="rom"
      />,
    );

    expect(await screen.findByRole('option', { name: 'Tomate (Roma)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tomate' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tomate (Cherry)' })).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('Rom').tagName.toLowerCase()).toBe('mark');
  });

  it('shows only the pending-suggestion icon for a species with a single pending variety', async () => {
    const pendingCrops: PublicCrop[] = [{
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
        crops={pendingCrops}
        selectedCropId={null}
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
    const pendingCrops: PublicCrop[] = [
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
        crops={pendingCrops}
        selectedCropId={null}
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
