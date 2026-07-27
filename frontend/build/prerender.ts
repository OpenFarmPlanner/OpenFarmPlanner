/**
 * Build-time prerendering for OpenFarmPlanner's public, static pages.
 *
 * OpenFarmPlanner stays a plain client-rendered React SPA — this script does
 * not introduce SSR or a Node runtime in production. It runs once, after
 * `vite build` (wired up as the `postbuild` npm script), as a small
 * standalone Node step:
 *
 *   1. serve the just-built `dist/` with Vite's own `preview()` server
 *      (same static assets production will serve, no dev-only behavior);
 *   2. use Playwright (already a devDependency for this project's e2e tests)
 *      to load each entry in `PUBLIC_INDEXABLE_ROUTES` in a real browser and
 *      capture the fully client-rendered DOM — no backend is required, since
 *      none of these pages fetch data to render their initial content;
 *   3. normalize the `<head>` (title, canonical, robots, OG, Twitter tags) to
 *      the route-specific values from `seoConfig.ts`/`seoAssets.ts` (via
 *      `prerenderSeo.ts`) — the same source of truth `RouteSeo` uses at
 *      runtime and `seoPlugin` uses for the base `index.html` — so
 *      build-time and runtime never disagree;
 *   4. write the result as a real `index.html` file per route
 *      (`dist/index.html`, `dist/impressum/index.html`, ...), so a static
 *      file server can serve each public URL's actual content directly
 *      instead of falling back to the empty SPA shell.
 *
 * Every other route (the authenticated `/app/*` shell, login/register/reset,
 * invitations) is untouched: only `dist/index.html` and the folder-per-route
 * files listed above are written. The browser then boots the same SPA bundle
 * as before (`createRoot(...).render(...)`, no hydration) and takes over
 * normal client-side routing/i18n immediately — there is nothing route- or
 * language-specific baked into the bundle itself, just the initial markup.
 *
 * `prerenderSeo.ts` (the actual SEO logic) is loaded through Vite's SSR
 * module runner rather than imported directly, because it in turn imports
 * this project's `src/seo/*` modules using the same extensionless/aliased
 * imports as the rest of the app — something only Vite's resolver (not
 * Node's own ESM loader) understands.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer, preview } from 'vite';
import type { PublicRoute } from './prerenderSeo.ts';

interface PrerenderSeoModule {
  PUBLIC_INDEXABLE_ROUTES: readonly PublicRoute[];
  applyHeadTags: (html: string, route: PublicRoute, env: NodeJS.ProcessEnv) => string;
}

interface PrerenderedPage {
  routePath: string;
  outputPath: string;
  html: string;
}

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Mirrors `normalizeBasePath` in vite.config.ts — kept in sync deliberately
 * rather than imported, since vite.config.ts is not a module other code
 * should depend on. */
function normalizeBasePath(input?: string): string {
  const value = input && input.trim().length > 0 ? input.trim() : '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

const outDir = process.env.PRERENDER_OUT_DIR?.trim() || 'dist';
const base = normalizeBasePath(process.env.VITE_BASE_PATH);

function outputPathFor(distDir: string, routePath: string): string {
  if (routePath === '/') {
    return path.join(distDir, 'index.html');
  }
  return path.join(distDir, routePath.replace(/^\//, ''), 'index.html');
}

async function loadSeoHelpers(): Promise<PrerenderSeoModule> {
  const devServer = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'warn',
    // We only need `ssrLoadModule` for one small, React-free module below —
    // suppress Vite's default client dependency-optimizer scan (which
    // crawls from index.html/main.tsx) since nothing here ever serves the
    // app itself, and the scan otherwise races the server close() below.
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return await devServer.ssrLoadModule('/build/prerenderSeo.ts') as unknown as PrerenderSeoModule;
  } finally {
    await devServer.close();
  }
}

async function serializeCssInJsRules(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const styleElement of document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')) {
      if (styleElement.textContent?.trim()) {
        continue;
      }

      const sheet = styleElement.sheet;
      if (!sheet) {
        continue;
      }

      try {
        styleElement.textContent = Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        // Ignore inaccessible sheets. Emotion/MUI inserts same-document style
        // sheets, so this should not happen for the styles we need.
      }
    }
  });
}

async function main(): Promise<void> {
  const distDir = path.resolve(rootDir, outDir);
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`prerender: no build output at ${indexHtmlPath} — run "vite build" first.`);
  }

  const { PUBLIC_INDEXABLE_ROUTES, applyHeadTags } = await loadSeoHelpers();

  const server = await preview({
    root: rootDir,
    base,
    build: { outDir },
    preview: { port: 0, host: '127.0.0.1' },
    logLevel: 'warn',
  });
  const localUrl = server.resolvedUrls?.local[0];
  if (!localUrl) {
    await server.close();
    throw new Error('prerender: preview server did not resolve a local URL.');
  }

  try {
    // Reuses the same "chrome" channel binary the e2e workflow already
    // installs (playwright.config.ts's `chromium` project pins the same
    // channel) instead of the default bundled Chromium/headless-shell,
    // which is a separate download CI never installs.
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      const page = await browser.newPage();
      const prerenderedPages: PrerenderedPage[] = [];
      for (const route of PUBLIC_INDEXABLE_ROUTES) {
        const targetUrl = new URL(route.path.replace(/^\//, ''), localUrl).toString();
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        await page.waitForSelector('#root h1', { timeout: 10_000 });

        await serializeCssInJsRules(page);
        const html = await page.content();
        const finalHtml = applyHeadTags(html, route, process.env);

        prerenderedPages.push({
          routePath: route.path,
          outputPath: outputPathFor(distDir, route.path),
          html: finalHtml,
        });
      }

      for (const prerenderedPage of prerenderedPages) {
        const outputPath = prerenderedPage.outputPath;
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, prerenderedPage.html, 'utf-8');
        console.log(`prerender: ${prerenderedPage.routePath} -> ${path.relative(distDir, outputPath)}`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  // The Vite preview server keeps its listening socket open, which would
  // otherwise keep the process (and CI, up to its job timeout) alive even
  // after this handler runs — force an exit once the failure is reported.
  process.exitCode = 1;
  process.exit(1);
});
