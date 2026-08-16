import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CultureDetail } from '../cultures/CultureDetail';
import type { Culture } from '../api/types';

const importedCulture: Culture = {
  id: 1,
  name: 'Salat',
  variety: 'Bijella',
  origin_type: 'imported',
  is_modified_from_source: true,
  growth_duration_days: 45,
  harvest_duration_days: 21,
};

describe('CultureDetail library badges', () => {
  it('shows imported and modified badges for imported cultures', () => {
    render(
      <CultureDetail
        cultures={[importedCulture]}
        selectedCultureId={1}
        onCultureSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Importiert');
    screen.getByText('Lokal geändert');
  });

  it('marks a variety published under an unreviewed crop species as pending', () => {
    render(
      <CultureDetail
        cultures={[{ ...importedCulture, public_crop_species_pending: true }]}
        selectedCultureId={1}
        onCultureSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Vorschlag in Prüfung');
  });

  it('does not mark a variety whose crop species is already reviewed', () => {
    render(
      <CultureDetail
        cultures={[importedCulture]}
        selectedCultureId={1}
        onCultureSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.queryByText('Vorschlag in Prüfung')).not.toBeInTheDocument();
  });
});
