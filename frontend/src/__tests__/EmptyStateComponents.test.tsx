import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import EmptyStateCard from '../components/project/EmptyStateCard';
import RequirementChecklist from '../components/project/RequirementChecklist';

describe('Empty state components', () => {
  it('renders a neutral outlined empty-state container with consistent action variants', () => {
    render(
      <MemoryRouter>
        <EmptyStateCard
          title="Noch keine Daten"
          description="Lege zuerst Daten an."
          actions={[
            { label: 'Primäre Aktion', to: '/app/crops' },
            { label: 'Sekundäre Aktion', to: '/app/fields-beds' },
          ]}
        />
      </MemoryRouter>,
    );

    const primary = screen.getByRole('link', { name: 'Primäre Aktion' });
    const secondary = screen.getByRole('link', { name: 'Sekundäre Aktion' });

    expect(screen.getByTestId('InfoOutlinedIcon')).toBeInTheDocument();
    expect(screen.getByText('Noch keine Daten')).toBeInTheDocument();
    expect(screen.getByText('Lege zuerst Daten an.')).toBeInTheDocument();
    expect(primary.className).toContain('MuiButton-contained');
    expect(secondary.className).toContain('MuiButton-outlined');
  });

  it('does not render same-route link actions without navigation intent', () => {
    render(
      <MemoryRouter initialEntries={['/app/fields-beds']}>
        <EmptyStateCard
          title="Es sind noch keine Beete vorhanden."
          description="Füge Beete über das Plus-Symbol bei der jeweiligen Parzelle hinzu."
          actions={[
            { label: 'Anbauflächen öffnen', to: '/app/fields-beds' },
            { label: 'Anbauplan hinzufügen', to: '/app/planting-plans?create=true' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Anbauflächen öffnen' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anbauplan hinzufügen' })).toBeInTheDocument();
  });

  it('renders without requiring a router context', () => {
    render(
      <EmptyStateCard
        title="Noch keine Kulturen vorhanden"
        description="Öffne die Kulturbibliothek oder lege eine eigene Kultur an."
        actions={[
          { label: 'Kulturbibliothek öffnen', onClick: () => undefined },
        ]}
      />,
    );

    expect(screen.getByText('Noch keine Kulturen vorhanden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kulturbibliothek öffnen' })).toBeInTheDocument();
  });

  it('shows requirement states without duplicated status text', () => {
    render(
      <RequirementChecklist
        items={[
          { label: 'Kultur', satisfied: true },
          { label: 'Beet', satisfied: false },
        ]}
      />,
    );

    expect(screen.getByText('Kultur vorhanden')).toBeInTheDocument();
    expect(screen.getByText('Beet fehlt')).toBeInTheDocument();
    expect(screen.queryByText('Kultur vorhanden vorhanden')).not.toBeInTheDocument();
    expect(screen.queryByText('Beet fehlt fehlt')).not.toBeInTheDocument();
  });
});
