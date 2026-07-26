import { expect, test } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

test.describe('fields-beds row edit exit behavior', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'fields-click-outside-0', { loginAsAdmin: true });
    await page.goto('/app/fields-beds');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('Escape on an empty new field removes it immediately, no reload needed', async ({ page }) => {
    const rowCountBefore = await page.locator('[role="row"][data-id]').count();

    await page.getByRole('button', { name: 'Parzelle hinzufügen' }).first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('[role="row"][data-id]')).toHaveCount(rowCountBefore);
  });

  test('clicking outside the grid commits a valid new field instead of discarding it', async ({ page }) => {
    await page.getByRole('button', { name: 'Parzelle hinzufügen' }).first().click();
    await page.waitForTimeout(400);

    const nameInput = page.locator('.MuiDataGrid-row--editing input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('KlickAusserhalbParzelle');
    // MUI's default edit cell debounces committing keystrokes into its internal
    // edit state by ~200ms; clicking away sooner reads a stale (empty) draft.
    await page.waitForTimeout(300);

    // Click outside the grid entirely (not a Tab/blur within the grid) - simulates
    // a user clicking the page heading while a row is still being edited.
    await page.locator('h1', { hasText: 'Anbauflächen' }).click();
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText('KlickAusserhalbParzelle')).toBeVisible({ timeout: 5000 });

    // Reload to confirm the row was actually persisted to the backend, not just
    // visually retained in the grid's local state.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('KlickAusserhalbParzelle')).toBeVisible({ timeout: 5000 });
  });

  test('clicking outside the grid on a completely empty new field discards it', async ({ page }) => {
    const rowCountBefore = await page.locator('[role="row"][data-id]').count();

    await page.getByRole('button', { name: 'Parzelle hinzufügen' }).first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(1);

    await page.locator('h1', { hasText: 'Anbauflächen' }).click();
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('[role="row"][data-id]')).toHaveCount(rowCountBefore);
  });
});
