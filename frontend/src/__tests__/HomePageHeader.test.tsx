import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../pages/public/HomePage';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ startGuestDemo: vi.fn() }),
}));

function renderHomePage() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage header', () => {
  it('keeps the logo and the language selector in one row, logo first', () => {
    renderHomePage();

    const logo = screen.getByRole('heading', { level: 1 });
    const languageButton = screen.getByRole('button', { name: /Sprache/ });
    const header = logo.closest('header');

    expect(header).not.toBeNull();
    expect(header?.contains(languageButton)).toBe(true);
    // One row means one grid row: the header holds exactly the logo group and
    // the language selector.
    expect(header?.children.length).toBe(2);
    expect(logo.compareDocumentPosition(languageButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('centers the logo with two mirrored side columns so the selector cannot shift it', () => {
    renderHomePage();

    const logo = screen.getByRole('heading', { level: 1 });
    const languageButton = screen.getByRole('button', { name: /Sprache/ });
    const header = logo.closest('header') as HTMLElement;
    const headerStyle = window.getComputedStyle(header);

    expect(headerStyle.display).toBe('grid');
    // The empty first column and the selector's column share the same track
    // size, so the middle column stays centred whatever the language label is.
    const columns = headerStyle.gridTemplateColumns.split(' auto ');
    expect(columns).toHaveLength(2);
    expect(columns[0]).toBe(columns[1]);

    // The logo sits in the centre column, the selector in the trailing one.
    const logoGroup = logo.parentElement as HTMLElement;
    expect(window.getComputedStyle(logoGroup).gridColumn).toBe('2');
    const selectorCell = languageButton.parentElement as HTMLElement;
    expect(window.getComputedStyle(selectorCell).gridColumn).toBe('3');
  });
});
