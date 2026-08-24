import { expect, test, type Page } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

const backendPort = process.env.BACKEND_PORT ?? '8000';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

// 1100px keeps the desktop grid but is narrow enough for the responsive column
// visibility model to hide the two calculated harvest columns that sit right
// after "Pflanzdatum" — the case where Tab used to die on the date cell
// because the hidden columns shifted the index handed to MUI's scrollToIndexes.
const NARROW_DESKTOP_WIDTH = 1100;

const focusedField = async (page: Page): Promise<string | null> =>
  page.evaluate(() =>
    document.activeElement?.closest('[role="gridcell"]')?.getAttribute('data-field') ?? null);

async function createAutocompleteFixture(
  page: Page,
): Promise<{ planId: number; targetCultureName: string }> {
  const activeProjectId = await page.evaluate(() => window.localStorage.getItem('activeProjectId'));
  const projectId = Number(activeProjectId);
  const csrfToken = await page.evaluate(() =>
    document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '');

  const api = async <T,>(path: string, data: Record<string, unknown>): Promise<T> => {
    const response = await page.request.post(`${apiBase}${path}`, {
      headers: {
        'X-CSRFToken': csrfToken,
        'Content-Type': 'application/json',
        'X-Project-Id': String(projectId),
      },
      data: { ...data, project: projectId },
    });
    expect(response.ok(), `${path} -> ${response.status()}: ${await response.text()}`).toBeTruthy();
    return response.json() as Promise<T>;
  };

  const location = await api<{ id: number }>('/locations/', { name: 'Tastaturhof' });
  const field = await api<{ id: number }>('/fields/', { name: 'Tabfeld', location: location.id });
  const bed = await api<{ id: number }>('/beds/', { name: 'Autocomplete-Beet', field: field.id, area_sqm: 12 });
  const initialCulture = await api<{ id: number }>('/cultures/', {
    name: 'Bohne',
    variety: 'Start',
    cultivation_type: 'direct_sowing',
    cultivation_types: ['direct_sowing'],
    plants_per_m2: 6,
  });
  await api<{ id: number }>('/cultures/', {
    name: 'Zucchini',
    variety: 'Enter',
    cultivation_type: 'direct_sowing',
    cultivation_types: ['direct_sowing'],
    plants_per_m2: 1,
  });

  const plan = await api<{ id: number }>('/planting-plans/', {
    bed: bed.id,
    culture: initialCulture.id,
    cultivation_type: 'direct_sowing',
    planting_date: '2026-05-01',
    area_usage_sqm: 2,
  });

  return { planId: plan.id, targetCultureName: 'Zucchini (Enter)' };
}

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

  test('Enter commits the highlighted searchable culture option before grid navigation handles the key', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const { planId, targetCultureName } = await createAutocompleteFixture(page);

    await page.goto('/app/planting-plans');
    await expect(page.getByRole('heading', { name: 'Anbaupläne' })).toBeVisible();
    const firstRow = page.locator(`[role="row"][data-id="${planId}"]`);
    const cultureCell = firstRow.locator('[data-field="culture"]');
    await expect(cultureCell).toBeVisible();

    await cultureCell.dblclick();
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(1);
    const editor = page.locator('.MuiDataGrid-row--editing [data-field="culture"] input[role="combobox"]');
    await expect(editor).toBeFocused();

    await editor.fill('Zucchini');
    await expect(page.getByRole('option', { name: targetCultureName })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    const highlightedCultureName = (await page.locator('[role="option"].Mui-focused').innerText()).trim();
    await page.keyboard.press('Enter');

    await expect(editor).toHaveValue(highlightedCultureName);
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(1);

    await page.keyboard.press('Tab');
    await expect.poll(() => focusedField(page)).toBe('cultivation_type');
  });
});
