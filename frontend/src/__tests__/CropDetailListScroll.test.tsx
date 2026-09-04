import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CropDetail } from '../crops/CropDetail';
import type { Crop } from '../api/api';
import translations from '@/test-utils/translations';
import i18n from '../i18n/config';

// jsdom has no layout: the crop list needs stubbed metrics to behave like a
// scrollable container at all. Kept in its own file because the stubs are
// installed on Element.prototype and would otherwise affect unrelated tests.
const CLIENT_HEIGHT = 240;
const SCROLL_HEIGHT = 1200;
const scrollTops = new WeakMap<Element, number>();

const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
const originalScrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
const originalClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');

Object.defineProperty(Element.prototype, 'scrollTop', {
  configurable: true,
  get(this: Element) {
    return scrollTops.get(this) ?? 0;
  },
  set(this: Element, value: number) {
    scrollTops.set(this, Math.max(0, Math.min(value, SCROLL_HEIGHT - CLIENT_HEIGHT)));
  },
});
Object.defineProperty(Element.prototype, 'scrollHeight', {
  configurable: true,
  get: () => SCROLL_HEIGHT,
});
Object.defineProperty(Element.prototype, 'clientHeight', {
  configurable: true,
  get: () => CLIENT_HEIGHT,
});

const crops: Crop[] = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: `Kultur ${index + 1}`,
  growth_duration_days: 42,
  harvest_duration_days: 14,
}));

describe('CropDetail crop list scroll position', () => {
  beforeEach(async () => {
    window.sessionStorage.clear();
    await i18n.changeLanguage('de');
  });

  afterAll(() => {
    if (originalScrollTop) {
      Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTop);
    }
    if (originalScrollHeight) {
      Object.defineProperty(Element.prototype, 'scrollHeight', originalScrollHeight);
    }
    if (originalClientHeight) {
      Object.defineProperty(Element.prototype, 'clientHeight', originalClientHeight);
    }
  });

  it('keeps the scroll position when the list is remounted by a refetch', () => {
    const { rerender } = render(
      <MemoryRouter>
        <CropDetail crops={crops} selectedCropId={1} onCropSelect={vi.fn()} />
      </MemoryRouter>,
    );

    const list = screen.getByRole('listbox', { name: translations.crops.title });
    list.scrollTop = 360;
    fireEvent.scroll(list);

    rerender(
      <MemoryRouter>
        <CropDetail crops={crops} selectedCropId={1} onCropSelect={vi.fn()} isLoading />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <CropDetail crops={crops} selectedCropId={1} onCropSelect={vi.fn()} />
      </MemoryRouter>,
    );

    const remountedList = screen.getByRole('listbox', { name: translations.crops.title });
    expect(remountedList).not.toBe(list);
    expect(remountedList.scrollTop).toBe(360);
  });
});
