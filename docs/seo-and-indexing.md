# SEO & Search-Engine Indexing

OpenFarmPlanner's frontend is a client-rendered React SPA (Vite) that is
deployed as static assets and served from the site root by the operations
stack (see `OpenFarmPlanner-ops`). The Django backend is API-only and does
**not** serve the SPA or any SEO artifact. Everything below is therefore
produced by the **frontend build**.

## What is indexable

Indexable public pages (also the sitemap entries):

| Path                   | Purpose                        |
| ---------------------- | ------------------------------ |
| `/`                    | Public landing page            |
| `/impressum`           | Imprint (legal)                |
| `/datenschutz`         | Privacy policy (legal)         |
| `/nutzungsbedingungen` | Terms of service (legal)       |

Explicitly **not** indexable (disallowed in `robots.txt` and served with a
`noindex, nofollow` robots meta at runtime):

- `/app/*` — the authenticated application
- `/login`, `/register`, `/activate`, `/forgot-password`, `/reset-password`,
  `/confirm-email-change`
- `/invite/*`, `/invitation`

The single source of truth for both lists is
[`frontend/src/seo/seoConfig.ts`](../frontend/src/seo/seoConfig.ts)
(`PUBLIC_INDEXABLE_ROUTES` and `NON_INDEXABLE_PATH_PREFIXES`). Add a new public
route there and it flows automatically into the sitemap, the runtime canonical
logic and the tests. When the planned public crop library (`/crops`, see
[crop-library-architecture.md](crop-library-architecture.md)) ships, add its
public routes to `PUBLIC_INDEXABLE_ROUTES`.

## How robots.txt and sitemap.xml are generated

They are **not** static files under `frontend/public/`. They are generated at
build time by the Vite plugin
[`frontend/build/seoPlugin.ts`](../frontend/build/seoPlugin.ts) from the
central config, so the canonical domain and route list are never duplicated:

- `generateBundle` emits `dist/robots.txt` and `dist/sitemap.xml`.
- `transformIndexHtml` injects `<link rel="canonical">`, the `robots` meta and
  the Open Graph / Twitter tags into `dist/index.html`, so crawlers get real
  metadata from the very first (pre-JavaScript) HTML response.
- `configureServer` / `configurePreviewServer` serve the same `/robots.txt` and
  `/sitemap.xml` from `vite` (dev) and `vite preview`, so local verification
  uses the same URLs as production.

At runtime, [`frontend/src/seo/RouteSeo.tsx`](../frontend/src/seo/RouteSeo.tsx)
keeps the canonical and `robots` meta correct during client-side navigation —
in particular it sets `noindex, nofollow` on every private/app/auth route. This
complements `robots.txt` (which prevents crawling) for crawlers that render
JavaScript.

## Build-time prerendering of public pages

OpenFarmPlanner stays a plain client-rendered SPA — there is no SSR server and
no per-request rendering in production. But `dist/index.html` alone cannot
carry per-route content, so a JS-less crawler hitting `/impressum` previously
saw the *landing page's* markup and metadata (served via the SPA fallback)
until client JS executed and React Router rendered the right page.

[`frontend/build/prerender.ts`](../frontend/build/prerender.ts) closes that
gap as a one-off **build** step (wired up as the `postbuild` npm script, so it
always runs right after `vite build`):

1. serves the just-built `dist/` with Vite's own `preview()` server;
2. uses Playwright (already a devDependency for e2e) to load each entry of
   `PUBLIC_INDEXABLE_ROUTES` in a real headless browser and capture the fully
   client-rendered DOM — no backend is required, since none of these pages
   need to fetch data to render their initial content;
3. serializes the CSS-in-JS rules that Emotion/MUI inserted through the
   browser CSSOM back into the prerendered `<style data-emotion>` tags, so the
   first paint is styled even before the JavaScript bundle boots;
4. normalizes `<head>` (title, canonical, robots, description, OG, Twitter) to
   the route-specific values from `seoConfig.ts`/`seoAssets.ts` — the same
   source `RouteSeo` and `seoPlugin` already use, via the pure helper
   [`frontend/build/prerenderSeo.ts`](../frontend/build/prerenderSeo.ts) — so
   build-time and runtime tags never disagree or duplicate;
5. writes the result as a real file per route: `dist/index.html`,
   `dist/impressum/index.html`, `dist/datenschutz/index.html`,
   `dist/nutzungsbedingungen/index.html`.

Every other route (`/app/*`, `/login`, `/register`, password reset,
invitations, ...) is untouched — only the four files above are written. The
browser then boots the exact same SPA bundle as before
(`createRoot(...).render(...)`, no hydration) and takes over normal
client-side routing/i18n immediately; there is nothing route- or
language-specific baked into the JS bundle itself, only the initial markup.

Because the app hardcodes German (`SITE_LANGUAGE = 'de'` in `seoConfig.ts`,
`i18next`'s `lng`/`fallbackLng` both `'de'`, no client-side language
detection), the prerendered HTML and the first client render are always in
the same language — there is no content-language flash to guard against
today. If language detection is ever added, prerendering must be revisited
together with it.

`PRERENDER_OUT_DIR` (default `dist`) tells the script which build output
directory to prerender into, mirroring `vite build --outDir`; ops sets this
alongside `VITE_BASE_PATH` when building into `dist-production`/`dist-staging`
(see `OpenFarmPlanner-ops/deploy/deploy_frontend.sh`).

**Local verification caveat:** `vite preview`'s static file server only
resolves a route's prerendered `index.html` for a *trailing-slash* request
(`/impressum/`), the same way production Apache 301-redirects `/impressum` to
`/impressum/` before serving it (see `deploy_frontend.sh`'s generated
`.htaccess`, which passes real files/directories straight through via its
`-f`/`-d` rewrite condition). `curl`ing `/impressum` (no trailing slash)
against a local `vite preview` therefore falls back to the SPA shell — that is
a `vite preview`-only serving detail, not a prerendering bug; add `-L` to
`curl` or use the trailing-slash URL locally.

## Environment variables

| Variable               | Default                         | Effect                                                                                                    |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `VITE_PUBLIC_SITE_URL` | `https://openfarmplanner.org`   | Canonical origin used for canonical/OG URLs, the `robots.txt` `Sitemap:` line and sitemap `<loc>` values. |
| `VITE_SEO_INDEXABLE`   | `true`                          | `false`/`0`/`no`/`off` → `robots.txt` becomes `Disallow: /` and a `noindex` meta is emitted.               |

**Production** must build with `VITE_PUBLIC_SITE_URL=https://openfarmplanner.org`
and `VITE_SEO_INDEXABLE` unset (or `true`).

**Preview / staging / test** builds should set `VITE_SEO_INDEXABLE=false` so
those hosts are deliberately kept out of search indexes. This is the only
supported way to block indexing environment-dependently — never ship a blanket
block to production.

## Local verification

Build and inspect the emitted artifacts:

```bash
cd frontend
VITE_PUBLIC_SITE_URL=https://openfarmplanner.org npm run build
cat dist/robots.txt
cat dist/sitemap.xml
grep -E 'canonical|robots|og:|twitter:' dist/index.html
```

Or serve the production build and check over HTTP (no external service needed):

```bash
cd frontend
npm run build && npm run preview   # serves on http://localhost:4173
curl -s http://localhost:4173/robots.txt
curl -s http://localhost:4173/sitemap.xml
curl -s http://localhost:4173/ | grep -E 'rel="canonical"|name="robots"'
```

Check the prerendered per-route HTML directly (no server needed — this is the
actual file a static host will serve for that URL):

```bash
cd frontend
npm run build   # postbuild runs prerender.ts automatically
grep -E '<title>|rel="canonical"|name="description"' dist/impressum/index.html
grep -E '<title>|rel="canonical"|name="description"' dist/datenschutz/index.html
grep -E '<title>|rel="canonical"|name="description"' dist/nutzungsbedingungen/index.html
```

Or over HTTP against `vite preview` — note the trailing slash (see the caveat
above):

```bash
curl -sL http://localhost:4173/impressum/ | grep -E '<title>|rel="canonical"'
```

Confirm a non-production build blocks indexing:

```bash
cd frontend
VITE_SEO_INDEXABLE=false npm run build
cat dist/robots.txt      # expect: Disallow: /
grep 'name="robots"' dist/index.html   # expect: noindex, nofollow
```

Run the SEO tests:

```bash
cd frontend
npx vitest run src/seo build
```

Run the prerendering e2e checks (build output content, canonical/robots per
route, non-indexable routes never prerendered, no-JS content visibility,
client nav after loading a prerendered page):

```bash
cd frontend
npm run build && npx playwright test e2e/public-page-prerendering.spec.ts
```

## Production diagnosis after deployment

Run these against the live site (replace the host if verifying a preview):

```bash
# Status + redirect chain to the canonical URL (expect a single 200 at the end)
curl -sSIL https://openfarmplanner.org/ | grep -iE '^HTTP/|^location:'

# All host/scheme variants should end on exactly one canonical https URL
for u in http://openfarmplanner.org https://openfarmplanner.org \
         http://www.openfarmplanner.org https://www.openfarmplanner.org; do
  echo "== $u =="; curl -sSIL "$u" | grep -iE '^HTTP/|^location:'
done

# robots.txt and sitemap.xml must return 200 and correct content types
curl -sSI https://openfarmplanner.org/robots.txt
curl -sSI https://openfarmplanner.org/sitemap.xml

# The landing HTML must NOT contain a noindex directive and MUST have a canonical
curl -s https://openfarmplanner.org/ | grep -iE 'rel="canonical"|name="robots"'

# There must be no X-Robots-Tag: noindex response header (this is set by the
# web server / proxy, i.e. in OpenFarmPlanner-ops, not in this repository)
curl -sSI https://openfarmplanner.org/ | grep -i 'x-robots-tag'
```

### What this repository can and cannot fix

- **Fixable here:** the initial HTML metadata (canonical, robots, OG/Twitter),
  `robots.txt`, `sitemap.xml`, per-route `noindex` for private pages, and the
  canonical-domain configuration. All covered above.
- **Hosting / proxy / DNS (OpenFarmPlanner-ops):** any `X-Robots-Tag: noindex`
  response header, HTTP→HTTPS and `www`→non-`www` redirects, TLS, and the actual
  static serving of `robots.txt` / `sitemap.xml`. A previously-indexed site that
  silently dropped out of Google — while still being found by other engines — is
  most consistent with an `X-Robots-Tag: noindex` header (or a `robots.txt`
  `Disallow: /`) introduced at the proxy, e.g. during a beta/demo phase. Verify
  with the `curl` header checks above and remove any such directive in the ops
  configuration.
- **Google Search Console only:** submitting/pinging the sitemap, requesting
  re-indexing, and reviewing the "Page indexing" / "Removals" reports and any
  manual actions. These cannot be inspected from the codebase.
