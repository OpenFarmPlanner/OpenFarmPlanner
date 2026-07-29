import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HeroImage from '../components/HeroImage';

describe('HeroImage', () => {
  it('renders eagerly with a high fetch priority and reserved dimensions', () => {
    render(<HeroImage alt="A field" />);

    const img = screen.getByRole('img', { name: 'A field' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
  });

  it('starts transparent and fades in once the image has loaded', () => {
    render(<HeroImage alt="A field" />);

    const img = screen.getByRole('img', { name: 'A field' });
    expect(img).toHaveStyle({ opacity: 0 });

    fireEvent.load(img);

    expect(img).toHaveStyle({ opacity: 1 });
  });

  it('renders an overlay above the image when overlaySx is provided', () => {
    const { container } = render(
      <HeroImage alt="" overlaySx={{ backgroundImage: 'linear-gradient(red, blue)' }} />,
    );

    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
  });
});
