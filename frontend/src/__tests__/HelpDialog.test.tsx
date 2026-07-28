import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpDialog } from '../components/help/HelpDialog';

describe('HelpDialog', () => {
  it('covers every main navigation page and keeps the workflow line untouched', async () => {
    render(<HelpDialog open onClose={vi.fn()} />);

    expect(await screen.findByText('Überblick: So funktioniert OpenFarmPlanner')).toBeInTheDocument();

    for (const title of [
      'Übersicht',
      'Anbauflächen',
      'Kulturbibliothek',
      'Anbaupläne',
      'Anbaukalender',
      'Ertragsübersicht',
      'Saatgutbedarf',
      'Lieferanten',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    expect(screen.getByText('Anbauflächen → Kulturbibliothek → Anbaupläne → Anbaukalender → Saatgutbedarf')).toBeInTheDocument();
  });
});
