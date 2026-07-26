import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it } from 'vitest';
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
});
