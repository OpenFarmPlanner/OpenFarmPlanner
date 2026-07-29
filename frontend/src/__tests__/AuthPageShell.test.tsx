import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import AuthPageShell from '../pages/auth/AuthPageShell';

describe('AuthPageShell header', () => {
  it('places the logo and the language selector in the same header row, logo first', () => {
    render(
      <MemoryRouter>
        <AuthPageShell title="Title" subtitle="Subtitle">
          <div>content</div>
        </AuthPageShell>
      </MemoryRouter>,
    );

    const logo = screen.getByText('OpenFarmPlanner');
    const languageButton = screen.getByRole('button', { name: /Sprache/ });

    // Both live in the same flex row, not in separate stacked rows: walk up
    // from the logo to the nearest ancestor that also contains the language
    // button, and confirm that ancestor is not the whole page (i.e. it's a
    // tight header row, not just "somewhere on the same page").
    let headerRow: HTMLElement | null = logo.parentElement;
    while (headerRow && !headerRow.contains(languageButton)) {
      headerRow = headerRow.parentElement;
    }
    expect(headerRow).not.toBeNull();
    expect(headerRow?.children.length).toBeLessThanOrEqual(2);

    // Logo (left) precedes the language selector (right) in DOM order.
    const relation = logo.compareDocumentPosition(languageButton);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the language selector as a subtle text-style control, not a prominent primary button', () => {
    render(
      <MemoryRouter>
        <AuthPageShell title="Title" subtitle="Subtitle">
          <div>content</div>
        </AuthPageShell>
      </MemoryRouter>,
    );

    const languageButton = screen.getByRole('button', { name: /Sprache/ });
    expect(languageButton.className).not.toMatch(/MuiButton-contained/);
  });
});
