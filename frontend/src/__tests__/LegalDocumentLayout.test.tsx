import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ImprintPage from '../pages/public/ImprintPage';
import PrivacyPolicyPage from '../pages/public/PrivacyPolicyPage';
import TermsOfServicePage from '../pages/public/TermsOfServicePage';

const legalPages = [
  ['Imprint', ImprintPage],
  ['Privacy policy', PrivacyPolicyPage],
  ['Terms of service', TermsOfServicePage],
] as const;

function renderPage(Page: (typeof legalPages)[number][1]): void {
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

function getLanguageSwitcher(): HTMLElement {
  return screen.getByRole('button', { name: /Sprache/ });
}

function getDocumentContainer(): HTMLElement {
  return screen.getByRole('heading', { level: 1 }).closest('.MuiContainer-root') as HTMLElement;
}

describe.each(legalPages)('%s layout', (_name, Page) => {
  it('pins the language switcher to the top-right corner of the document container', () => {
    renderPage(Page);

    const container = getDocumentContainer();
    const switcherRow = getLanguageSwitcher().parentElement as HTMLElement;

    expect(container).toBeInTheDocument();
    expect(getComputedStyle(container).position).toBe('relative');
    expect(getComputedStyle(switcherRow).position).toBe('absolute');
    expect(switcherRow.parentElement).toBe(container);
  });

  it('keeps the switcher out of the document flow instead of giving it its own row', () => {
    renderPage(Page);

    const heading = screen.getByRole('heading', { level: 1 });
    const flowRoot = heading.parentElement?.parentElement as HTMLElement;

    // The heading's Stack is the first element in the flow: nothing (least of
    // all the switcher) may sit above it and push the document down.
    expect(flowRoot.firstElementChild).toBe(heading.parentElement);
    expect(within(heading.parentElement as HTMLElement).queryByRole('button', { name: /Sprache/ })).toBeNull();
  });

  it('centres the document title', () => {
    renderPage(Page);

    expect(getComputedStyle(screen.getByRole('heading', { level: 1 })).textAlign).toBe('center');
  });
});
