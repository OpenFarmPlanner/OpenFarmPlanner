import { expect, test } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

// The planting plans page keeps the desktop EditableDataGrid mounted on mobile
// (hidden off-screen) purely as the imperative grid API host. With
// surfaceSizing="contentFit" that hidden grid used `width: max-content`, which
// collapses to 0 inside the hidden container - MUI X then renders the grid at
// 0px and logs "useResizeContainer ... empty width" in development builds. On
// mobile the grid is never shown, so it now uses the full-width surface sizing
// and stays bound to its container width. The e2e suite runs the production
// build (no MUI dev warning), so assert the underlying sizing instead.

test('planting plans mobile data grid stays bound to the viewport width', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await loginWithDeterministicProject(page, request, 'data-grid-resize-mobile', {
    demoProject: true,
    loginAsAdmin: true,
  });

  await page.goto('/app/planting-plans');
  await expect(page.getByRole('heading', { name: 'Anbaupläne' })).toBeVisible();

  const gridRoot = page.locator('.MuiDataGrid-root').first();
  await expect(gridRoot).toBeAttached();
  // contentFit sizing would let the hidden grid grow to its combined column
  // width (well beyond the 375px viewport); fullWorkspace keeps it at 100%.
  await expect
    .poll(async () => gridRoot.evaluate((element) => Math.round(element.getBoundingClientRect().width)))
    .toBeLessThanOrEqual(375);
});

test('planting plans desktop data grid still renders with an intrinsic width', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginWithDeterministicProject(page, request, 'data-grid-resize-desktop', {
    demoProject: true,
    loginAsAdmin: true,
  });

  await page.goto('/app/planting-plans');
  await expect(page.getByRole('heading', { name: 'Anbaupläne' })).toBeVisible();

  const gridRoot = page.locator('.MuiDataGrid-root').first();
  await expect(gridRoot).toBeAttached();
  await expect
    .poll(async () => gridRoot.evaluate((element) => Math.round(element.getBoundingClientRect().width)))
    .toBeGreaterThan(0);
});
