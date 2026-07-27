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
  resolveIndexable,
  resolveSiteUrl,
  type PublicRoute,
  type SeoEnv,
} from '../src/seo/seoConfig';
import { buildHeadTags } from '../src/seo/seoAssets';

export { PUBLIC_INDEXABLE_ROUTES };
export type { PublicRoute };

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
