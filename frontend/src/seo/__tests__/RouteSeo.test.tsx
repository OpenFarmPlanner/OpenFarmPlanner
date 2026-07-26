import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import RouteSeo from '../RouteSeo';

function robotsContent(): string | null {
  return document.head
    .querySelector('meta[name="robots"]')
    ?.getAttribute('content') ?? null;
}

function canonicalHref(): string | null {
  return document.head
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href') ?? null;
}

afterEach(() => {
  document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"]').forEach(
    (node) => node.remove(),
  );
});

describe('RouteSeo', () => {
  it('marks the public landing page as indexable with a root canonical', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteSeo />
      </MemoryRouter>,
    );
    await waitFor(() => expect(robotsContent()).toBe('index, follow'));
    expect(canonicalHref()).toBe('https://openfarmplanner.org/');
  });

  it('marks a public info page as indexable with its canonical', async () => {
    render(
      <MemoryRouter initialEntries={['/impressum']}>
        <RouteSeo />
      </MemoryRouter>,
    );
    await waitFor(() => expect(robotsContent()).toBe('index, follow'));
    expect(canonicalHref()).toBe('https://openfarmplanner.org/impressum');
  });

  it('sets noindex on private app routes', async () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <RouteSeo />
      </MemoryRouter>,
    );
    await waitFor(() => expect(robotsContent()).toBe('noindex, nofollow'));
  });

  it('sets noindex on authentication routes', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <RouteSeo />
      </MemoryRouter>,
    );
    await waitFor(() => expect(robotsContent()).toBe('noindex, nofollow'));
  });
});
