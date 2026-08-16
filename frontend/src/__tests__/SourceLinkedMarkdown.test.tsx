import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SourceLinkedMarkdown } from '../components/data-grid/SourceLinkedMarkdown';

describe('SourceLinkedMarkdown', () => {
  it('renders footnote references as internal source links without a separate footnotes section', () => {
    render(
      <SourceLinkedMarkdown>
        {`## Hinweise
laut ReinSaat[^reinsaat].

## Quellen
1. [ReinSaat](https://example.test/reinsaat)

[^reinsaat]: [ReinSaat](https://example.test/reinsaat)`}
      </SourceLinkedMarkdown>,
    );

    const sourceRef = screen.getByRole('link', { name: 'Zur Quelle 1 springen' });
    expect(sourceRef).toHaveAttribute('href', '#ofp-source-1');
    expect(screen.queryByText('Footnotes')).not.toBeInTheDocument();
    expect(screen.queryByText('[^reinsaat]:')).not.toBeInTheDocument();
  });

  it('scrolls to and highlights the matching source row instead of following the link normally', () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <SourceLinkedMarkdown>
        {`## Hinweise
laut Raimund[^raimund].

## Quellen
1. [ReinSaat](https://example.test/reinsaat)
2. [Raimund](https://example.test/raimund)

[^reinsaat]: [ReinSaat](https://example.test/reinsaat)
[^raimund]: [Raimund](https://example.test/raimund)`}
      </SourceLinkedMarkdown>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Zur Quelle 2 springen' }));

    const sourceRows = screen.getAllByRole('listitem');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(sourceRows[1]).toHaveAttribute('id', 'ofp-source-2');
    expect(sourceRows[1]).toHaveAttribute('data-ofp-source-highlight', 'true');
  });
});
