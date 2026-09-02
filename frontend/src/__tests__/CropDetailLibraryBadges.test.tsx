import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CropDetail } from '../crops/CropDetail';
import type { Crop } from '../api/types';

const importedCrop: Crop = {
  id: 1,
  name: 'Salat',
  variety: 'Bijella',
  origin_type: 'imported',
  is_modified_from_source: true,
  growth_duration_days: 45,
  harvest_duration_days: 21,
};

describe('CropDetail library badges', () => {
  it('shows imported and modified badges for imported crops', () => {
    render(
      <CropDetail
        crops={[importedCrop]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Importiert');
    screen.getByText('Lokal geändert');
  });

  it('marks a variety published under an unreviewed crop species as pending', () => {
    render(
      <CropDetail
        crops={[{ ...importedCrop, public_crop_species_pending: true }]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Vorschlag in Prüfung');
  });

  it('does not mark a variety whose crop species is already reviewed', () => {
    render(
      <CropDetail
        crops={[importedCrop]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.queryByText('Vorschlag in Prüfung')).not.toBeInTheDocument();
  });
});
