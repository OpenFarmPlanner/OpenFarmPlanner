import { describe, expect, it } from 'vitest';
import { applyHeadTags, PUBLIC_INDEXABLE_ROUTES } from './prerenderSeo';

/**
 * Simulates what Playwright's `page.content()` actually captures: the base
 * `index.html` (already carrying seoPlugin's landing-page canonical/robots/
 * description/OG tags) plus whatever `RouteSeo` patched in at runtime for
 * the current route (it only touches canonical + robots).
 */
function sampleCapturedHtml(): string {
  return [
    '<!doctype html>',
    '<html lang="de"><head>',
    '  <meta charset="UTF-8">',
    '  <title>OpenFarmPlanner</title>',
    '  <meta name="description" content="Landing page default description">',
    '  <link rel="canonical" href="https://openfarmplanner.org/impressum">',
    '  <meta name="robots" content="index, follow">',
    '  <meta property="og:title" content="OpenFarmPlanner">',
    '  <meta property="og:description" content="Landing page default description">',
    '  <meta name="twitter:title" content="OpenFarmPlanner">',
    '</head><body><div id="root"><h1>Impressum</h1></div></body></html>',
  ].join('\n');
}

describe('applyHeadTags', () => {
  const impressumRoute = PUBLIC_INDEXABLE_ROUTES.find((route) => route.path === '/impressum')!;
  const env = { VITE_PUBLIC_SITE_URL: 'https://openfarmplanner.org' };

  it('sets the route-specific title, canonical and description exactly once', () => {
    const html = applyHeadTags(sampleCapturedHtml(), impressumRoute, env);

    expect(html).toContain('<title>Impressum – OpenFarmPlanner</title>');
    expect(html.match(/<title>/g)).toHaveLength(1);

    expect(html).toContain('href="https://openfarmplanner.org/impressum"');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);

    expect(html).toContain(impressumRoute.description!);
    expect(html.match(/name="description"/g)).toHaveLength(1);
  });

  it('removes the stale runtime/build-time OG and Twitter tags before adding the route-specific set', () => {
    const html = applyHeadTags(sampleCapturedHtml(), impressumRoute, env);

    expect(html).not.toContain('content="Landing page default description"');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(html).toContain(`content="${impressumRoute.title}"`);
  });

  it('keeps robots as index,follow for a public route on an indexable deployment', () => {
    const html = applyHeadTags(sampleCapturedHtml(), impressumRoute, env);

    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html).toContain('content="index, follow"');
  });

  it('emits noindex when the deployment is not indexable (e.g. staging)', () => {
    const html = applyHeadTags(sampleCapturedHtml(), impressumRoute, {
      ...env,
      VITE_SEO_INDEXABLE: 'false',
    });

    expect(html).toContain('content="noindex, nofollow"');
  });

  it('falls back to the site default title/description for the landing page', () => {
    const homeRoute = PUBLIC_INDEXABLE_ROUTES.find((route) => route.path === '/')!;
    const html = applyHeadTags(sampleCapturedHtml(), homeRoute, env);

    expect(html).toContain('<title>OpenFarmPlanner</title>');
    expect(html).toContain('href="https://openfarmplanner.org/"');
  });
});

describe('PUBLIC_INDEXABLE_ROUTES prerender coverage', () => {
  it('gives every non-root public route its own title and description', () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      if (route.path === '/') {
        continue;
      }
      expect(route.title, `${route.path} should define a title`).toBeTruthy();
      expect(route.description, `${route.path} should define a description`).toBeTruthy();
    }
  });
});
