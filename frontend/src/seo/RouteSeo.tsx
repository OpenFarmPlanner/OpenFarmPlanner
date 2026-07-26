/**
 * Runtime, route-aware SEO metadata for the SPA.
 *
 * The build injects static canonical/robots tags for the initial HTML (the
 * landing page). This component keeps them correct as the user (or a
 * JavaScript-rendering crawler such as Googlebot) navigates client-side:
 *
 *   - public info pages keep `robots: index, follow` and get a per-path canonical;
 *   - every private/auth/app route switches to `robots: noindex, nofollow`.
 *
 * It renders nothing and only mutates the document <head>. It complements — does
 * not replace — robots.txt: robots.txt stops crawling of private paths, while
 * this guards crawlers that render JS and ignore robots.txt.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  buildCanonicalUrl,
  isPathIndexable,
  resolveIndexable,
  resolveSiteUrl,
} from './seoConfig';

const SITE_URL = resolveSiteUrl(import.meta.env);
const DEPLOYMENT_INDEXABLE = resolveIndexable(import.meta.env);

function upsertMeta(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Side-effect-only component. Mount once near the router root so it runs on
 * every navigation.
 */
export default function RouteSeo(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    const indexable = isPathIndexable(pathname, DEPLOYMENT_INDEXABLE);
    upsertMeta('robots', indexable ? 'index, follow' : 'noindex, nofollow');
    upsertCanonical(buildCanonicalUrl(SITE_URL, pathname));
  }, [pathname]);

  return null;
}
