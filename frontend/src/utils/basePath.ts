/**
 * Normalizes the app's deployment base path to the `/…/` shape the API and
 * WebSocket URL builders both assume: exactly one leading and one trailing
 * slash, and `/` for an empty or missing value.
 */
export function normalizeBasePath(basePath?: string): string {
  const value = basePath && basePath.trim().length > 0 ? basePath.trim() : '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}
