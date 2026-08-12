import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router';
import ImprintPage from '../pages/public/ImprintPage';
import PrivacyPolicyPage from '../pages/public/PrivacyPolicyPage';
import TermsOfServicePage from '../pages/public/TermsOfServicePage';
import theme from '../theme';

const legalPages = [
  ['Imprint', ImprintPage],
  ['Privacy policy', PrivacyPolicyPage],
  ['Terms of service', TermsOfServicePage],
] as const;

function renderPage(Page: (typeof legalPages)[number][1]): void {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function getLanguageSwitcher(): HTMLElement {
  return screen.getByRole('button', { name: /Sprache/ });
}

function getDocumentHeader(): HTMLElement {
  return screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
}

const primaryGreen = 'rgb(37, 111, 42)';

describe.each(legalPages)('%s layout', (_name, Page) => {
  it('keeps the title and compact controls in one shared header', () => {
    renderPage(Page);

    const header = getDocumentHeader();
    const heading = screen.getByRole('heading', { level: 1 });
    const printButton = screen.getByRole('button', { name: 'Drucken / als PDF speichern' });
    const switcherRow = getLanguageSwitcher().parentElement as HTMLElement;

    expect(header).toBeInTheDocument();
    expect(getComputedStyle(header).display).toBe('grid');
    expect(heading.parentElement).toBe(header);
    expect(printButton.parentElement).toBe(switcherRow.parentElement);
  });

  it('uses an icon-only print action next to the language switcher', () => {
    renderPage(Page);

    const printButton = screen.getByRole('button', { name: 'Drucken / als PDF speichern' });
    const switcher = getLanguageSwitcher();
    const controls = printButton.parentElement as HTMLElement;

    expect(printButton).toHaveTextContent('');
    expect(printButton).toHaveAttribute('aria-label', 'Drucken / als PDF speichern');
    expect(within(controls).getByTestId('PrintIcon')).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: /Sprache/ })).toBe(switcher);
  });

  it('centres the document title', () => {
    renderPage(Page);

    const heading = screen.getByRole('heading', { level: 1 });

    expect(getComputedStyle(heading).justifySelf).toBe('center');
    expect(getComputedStyle(heading).textAlign).toBe('center');
  });

  it('uses the app accent colour for legal toolbar icons while keeping the title neutral', () => {
    renderPage(Page);

    const heading = screen.getByRole('heading', { level: 1 });
    const printIcon = screen.getByTestId('PrintIcon');
    const languageIcon = screen.getByTestId('LanguageIcon');

    expect(getComputedStyle(printIcon).color).toBe(primaryGreen);
    expect(getComputedStyle(languageIcon).color).toBe(primaryGreen);
    expect(getComputedStyle(heading).color).not.toBe(primaryGreen);
  });
});
