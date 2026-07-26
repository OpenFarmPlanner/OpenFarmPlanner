import { describe, it, expect, vi } from 'vitest';
import { seoPlugin } from './seoPlugin';

const SAMPLE_HTML = [
  '<!doctype html>',
  '<html lang="de">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <title>OpenFarmPlanner</title>',
  '  </head>',
  '  <body><div id="root"></div></body>',
  '</html>',
  '',
].join('\n');

function callTransformIndexHtml(plugin: ReturnType<typeof seoPlugin>, html: string): string {
  const hook = plugin.transformIndexHtml;
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  const result = (fn as (h: string) => unknown)?.call(plugin, html);
  return typeof result === 'string' ? result : String(result);
}

function collectEmittedFiles(plugin: ReturnType<typeof seoPlugin>) {
  const emitted: { fileName: string; source: string }[] = [];
  const ctx = {
    emitFile: (file: { fileName?: string; source?: string }) => {
      emitted.push({ fileName: file.fileName ?? '', source: String(file.source) });
    },
  };
  const hook = plugin.generateBundle;
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  (fn as (...args: unknown[]) => void)?.call(ctx);
  return emitted;
}

describe('seoPlugin transformIndexHtml', () => {
  it('injects canonical and OG tags into <head> for production', () => {
    const plugin = seoPlugin({ VITE_PUBLIC_SITE_URL: 'https://openfarmplanner.org' });
    const html = callTransformIndexHtml(plugin, SAMPLE_HTML);
    expect(html).toContain('<link rel="canonical" href="https://openfarmplanner.org/" />');
    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain('name="description"');
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('</head>');
    // The original title survives.
    expect(html).toContain('<title>OpenFarmPlanner</title>');
    expect(html).not.toContain('noindex');
  });

  it('injects a noindex directive when the environment is not indexable', () => {
    const plugin = seoPlugin({ VITE_SEO_INDEXABLE: 'false' });
    const html = callTransformIndexHtml(plugin, SAMPLE_HTML);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});

describe('seoPlugin generateBundle', () => {
  it('emits robots.txt and sitemap.xml', () => {
    const plugin = seoPlugin({ VITE_PUBLIC_SITE_URL: 'https://openfarmplanner.org' });
    const emitted = collectEmittedFiles(plugin);
    const names = emitted.map((f) => f.fileName);
    expect(names).toContain('robots.txt');
    expect(names).toContain('sitemap.xml');

    const robots = emitted.find((f) => f.fileName === 'robots.txt')!.source;
    expect(robots).toContain('Sitemap: https://openfarmplanner.org/sitemap.xml');
    expect(robots).not.toMatch(/^Disallow:\s*\/$/m);

    const sitemap = emitted.find((f) => f.fileName === 'sitemap.xml')!.source;
    expect(sitemap).toContain('<loc>https://openfarmplanner.org/</loc>');
  });

  it('emits a fully blocking robots.txt when not indexable', () => {
    const plugin = seoPlugin({ VITE_SEO_INDEXABLE: '0' });
    const robots = collectEmittedFiles(plugin).find((f) => f.fileName === 'robots.txt')!.source;
    expect(robots).toMatch(/^Disallow:\s*\/$/m);
  });
});

// Silence unused-import lint if vi ends up unused across environments.
void vi;
