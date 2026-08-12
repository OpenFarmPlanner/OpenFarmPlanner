/**
 * Pure logic shared between `build/prerender.ts` (the Node entry point) and
 * its unit tests: computing the final, route-specific `<head>` for a
 * prerendered page. Kept as its own module (rather than inlined in
 * prerender.ts) so it can be loaded through Vite's SSR module runner, which
 * resolves this project's usual extensionless/aliased imports the same way
 * `vite build`/`vitest` do — the Node entry point itself is executed
 * directly by Node (via `--experimental-strip-types`) and cannot resolve
 * those on its own.
 */

import { JSDOM } from 'jsdom';
import {
  PUBLIC_INDEXABLE_ROUTES,
  SITE_LANGUAGE,
  resolveIndexable,
  resolveSiteUrl,
  type PublicRoute,
  type SeoEnv,
} from '../src/seo/seoConfig';
import { buildHeadTags } from '../src/seo/seoAssets';

export { PUBLIC_INDEXABLE_ROUTES, SITE_LANGUAGE };
export type { PublicRoute };

function isLoopbackHttpUrl(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function removeLocalPreviewPreloads(document: Document): void {
  document.querySelectorAll('link[href]').forEach((element) => {
    const rel = (element.getAttribute('rel') ?? '').toLowerCase();
    if (!['modulepreload', 'preload', 'prefetch'].includes(rel)) {
      return;
    }
    if (isLoopbackHttpUrl(element.getAttribute('href'))) {
      element.remove();
    }
  });
}

export function assertNoLoopbackUrls(html: string, routePath: string): void {
  const matches = html.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(?::\d+)?[^\s"'<>)]*/g);
  if (matches?.length) {
    const uniqueMatches = [...new Set(matches)];
    throw new Error(
      `prerender: ${routePath} contains local preview URL(s): ${uniqueMatches.join(', ')}`
    );
  }
}

/**
 * Rewrite `<head>` in a captured, client-rendered document to the
 * route-specific canonical values. Strips whatever `seoPlugin` baked into
 * the base `index.html` and whatever `RouteSeo` already patched in at
 * runtime (it only touches canonical/robots) before re-adding the full,
 * consistent set for this route — this is what keeps build-time and runtime
 * SEO tags from ever duplicating or disagreeing.
 */
export function applyHeadTags(html: string, route: PublicRoute, env: SeoEnv): string {
  const siteUrl = resolveSiteUrl(env);
  const indexable = resolveIndexable(env);

  const dom = new JSDOM(html);
  const { document } = dom.window;

  removeLocalPreviewPreloads(document);

  document.title = route.title ?? 'OpenFarmPlanner';

  document
    .querySelectorAll(
      'link[rel="canonical"], meta[name="robots"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]',
    )
    .forEach((element) => element.remove());

  const tags = buildHeadTags({
    siteUrl,
    indexable,
    title: route.title,
    description: route.description,
    path: route.path,
  });
  for (const tagHtml of tags) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = tagHtml;
    const element = wrapper.firstElementChild;
    if (element) {
      document.head.appendChild(element);
    }
  }

  return dom.serialize();
}
