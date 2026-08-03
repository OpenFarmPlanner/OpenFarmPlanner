import { expect, test, type Page } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

// 1100px keeps the desktop grid but is narrow enough for the responsive column
// visibility model to hide the two calculated harvest columns that sit right
// after "Pflanzdatum" — the case where Tab used to die on the date cell
// because the hidden columns shifted the index handed to MUI's scrollToIndexes.
const NARROW_DESKTOP_WIDTH = 1100;

const focusedField = async (page: Page): Promise<string | null> =>
  page.evaluate(() =>
    document.activeElement?.closest('[role="gridcell"]')?.getAttribute('data-field') ?? null);

test.describe('planting plans tab navigation with hidden columns', () => {
  test.beforeEach(async ({ page, request }) => {
    await page.setViewportSize({ width: NARROW_DESKTOP_WIDTH, height: 900 });
    await loginWithDeterministicProject(page, request, 'planting-plans-tab-navigation', {
      demoProject: true,
      loginAsAdmin: true,
    });
    await page.goto('/app/planting-plans');
    await expect(page.getByRole('heading', { name: 'Anbaupläne' })).toBeVisible();
    await expect(page.locator('[role="row"][data-id]').first()).toBeVisible();
  });

  test('Tab and Shift+Tab keep moving between editable cells around the date cell', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const rowWithEditablePlantCount = page
      .locator('[role="row"][data-id]')
      .filter({ has: page.locator('[data-field="plants_count"]', { hasText: /≈/ }) })
      .first();
    await expect(rowWithEditablePlantCount).toBeVisible();
    await rowWithEditablePlantCount.locator('[data-field="planting_date"]').dblclick();
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(1);
    await expect.poll(() => focusedField(page)).toBe('planting_date');

    await page.keyboard.press('Tab');
    await expect.poll(() => focusedField(page)).toBe('area_m2');

    await page.keyboard.press('Tab');
    await expect.poll(() => focusedField(page)).toBe('plants_count');

    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusedField(page)).toBe('area_m2');

    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusedField(page)).toBe('planting_date');

    expect(pageErrors).toEqual([]);
  });
});
