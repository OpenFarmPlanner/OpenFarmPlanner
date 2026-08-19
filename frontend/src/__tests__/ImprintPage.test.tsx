import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ImprintPage from '../pages/public/ImprintPage';

function renderImprintPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ImprintPage />
    </MemoryRouter>,
  );
}

describe('ImprintPage', () => {
  it('cites the Austrian ECG instead of the German TMG', () => {
    renderImprintPage();

    expect(screen.getByText(/§ 5 ECG/)).toBeInTheDocument();
    expect(screen.queryByText(/§ 5 TMG/)).not.toBeInTheDocument();
  });

  it('does not show the development-draft disclaimer in production', () => {
    renderImprintPage();

    expect(screen.queryByText(/Entwurfsstand/)).not.toBeInTheDocument();
    expect(screen.queryByText(/rechtlich final prüfen/)).not.toBeInTheDocument();
  });

  it('shows the Austrian provider address', () => {
    renderImprintPage();

    expect(screen.getAllByText(/Martin Stipsitz/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/9500 Villach/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Österreich/).length).toBeGreaterThan(0);
  });
});
