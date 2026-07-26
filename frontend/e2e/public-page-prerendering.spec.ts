import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { PUBLIC_INDEXABLE_ROUTES } from '../src/seo/seoConfig';

// This suite verifies build/prerender.ts's actual output, so it depends on
// `dist/` already containing a real `npm run build` (which runs the
// prerender step as its `postbuild`) — exactly what `test:e2e` does before
// launching Playwright. It intentionally reads files from disk rather than
// going through the `vite preview` webServer for the "no JS" assertions:
// `vite preview`'s static server only resolves a route's prerendered
// `index.html` for a *trailing-slash* request (`/impressum/`, matching how
// production Apache redirects `/impressum` -> `/impressum/` and then serves
// it) — reading the file directly sidesteps that unrelated serving detail
// and asserts on the artifact `build/prerender.ts` actually produced.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

function distPathFor(routePath: string): string {
  return routePath === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, routePath.replace(/^\//, ''), 'index.html');
}

test.describe('public page prerendering', () => {
  test('build produces a real index.html for every public route', () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      expect(existsSync(distPathFor(route.path)), `missing prerendered file for ${route.path}`).toBe(true);
    }
  });

  test('each prerendered page has real body content, not an empty SPA shell', () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      const html = readFileSync(distPathFor(route.path), 'utf-8');
      expect(html).toMatch(/<div id="root">\s*<[^/]/);
      expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
    }
  });

  test('each prerendered page has its own correct canonical URL and single description', () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      const html = readFileSync(distPathFor(route.path), 'utf-8');
      const canonical = route.path === '/'
        ? 'https://openfarmplanner.org/'
        : `https://openfarmplanner.org${route.path}`;
      expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    }
  });

  test('every prerendered page is marked index, follow', () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      const html = readFileSync(distPathFor(route.path), 'utf-8');
      expect(html).toContain('<meta name="robots" content="index, follow">');
    }
  });

  test('non-indexable routes are never prerendered', () => {
    expect(existsSync(path.join(distDir, 'app'))).toBe(false);
    expect(existsSync(path.join(distDir, 'login'))).toBe(false);
    expect(existsSync(path.join(distDir, 'register'))).toBe(false);
  });

  test('a JS-disabled browser sees the real privacy policy content, not a blank shell', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    // Trailing slash: see the module comment above re: vite preview's static
    // serving of directory-index files.
    await page.goto('/datenschutz/');
    await expect(page.locator('h1')).toHaveText('Datenschutzerklärung');
    await expect(page.getByText('Verantwortlicher', { exact: false }).first()).toBeVisible();
    await context.close();
  });

  test('the SPA takes over normally after loading a prerendered page (client nav still works)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toHaveText('OpenFarmPlanner');
    // Client-side nav from the prerendered landing page to another public
    // page should work exactly as on any other SPA route — proves the
    // bundle boots fine on top of the prerendered markup (no interactivity
    // blocked by whatever `createRoot(...).render()` replaced).
    await page.getByRole('link', { name: 'Impressum' }).click();
    await expect(page).toHaveURL(/\/impressum$/);
    await expect(page.locator('h1')).toHaveText('Impressum');
  });
});
