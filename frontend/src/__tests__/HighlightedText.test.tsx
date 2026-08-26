import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightedText } from '../components/HighlightedText';

describe('HighlightedText', () => {
  it('marks every occurrence of the needle', () => {
    render(<HighlightedText text="Kohlrabi Kohl" query="kohl" />);

    const marks = screen.getAllByText('Kohl', { selector: 'mark' });
    expect(marks).toHaveLength(2);
    expect(document.body.textContent).toBe('Kohlrabi Kohl');
  });

  it('leaves the text alone without a needle', () => {
    const { container } = render(<HighlightedText text="Karotte" query="" />);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Karotte');
  });

  it('leaves the text alone when the needle does not occur', () => {
    const { container } = render(<HighlightedText text="Karotte" query="zwiebel" />);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Karotte');
  });

  it('keeps the original casing of the marked slice', () => {
    render(<HighlightedText text="Rodelika" query="ka" />);

    expect(screen.getByText('ka', { selector: 'mark' })).toBeInTheDocument();
  });

  it('falls back to plain text when lower-casing would shift the offsets', () => {
    // 'İ' lower-cases to two code units, so every offset after it would point
    // at the wrong characters — better unmarked than marked wrongly.
    const { container } = render(<HighlightedText text="İstanbul" query="stan" />);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('İstanbul');
  });
});
