import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginWithDeterministicProject, waitForPageStable } from './utils';

async function openCreateCultureDialog(page: Page): Promise<Locator> {
  await page.goto('/app/cultures');
  await waitForPageStable(page, /Kulturbibliothek/i);
  await page.getByRole('button', { name: 'Kultur hinzufügen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Kultur hinzufügen' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function inputBox(input: Locator) {
  const box = await input.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test.describe('culture create dialog responsive identity row', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginWithDeterministicProject(page, request, `culture-form-responsive-${testInfo.workerIndex}`);
  });

  test('stacks name and variety at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const dialog = await openCreateCultureDialog(page);

    const nameBox = await inputBox(dialog.getByLabel(/^Name/));
    const varietyBox = await inputBox(dialog.getByLabel('Sorte (optional)'));
    const checkbox = dialog.getByRole('checkbox', { name: 'Werte auch als allgemeine Kulturwerte übernehmen' });

    expect(varietyBox.y).toBeGreaterThan(nameBox.y + nameBox.height);
    await expect(checkbox).toBeDisabled();
  });

  test('places name and variety side by side on desktop with a wider name field', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const dialog = await openCreateCultureDialog(page);

    const nameBox = await inputBox(dialog.getByLabel(/^Name/));
    const varietyBox = await inputBox(dialog.getByLabel('Sorte (optional)'));
    const checkbox = dialog.getByRole('checkbox', { name: 'Werte auch als allgemeine Kulturwerte übernehmen' });

    expect(Math.abs(nameBox.y - varietyBox.y)).toBeLessThan(4);
    expect(nameBox.width).toBeGreaterThan(varietyBox.width);
    await expect(checkbox).toBeDisabled();

    await dialog.getByLabel('Sorte (optional)').fill('Nantaise');
    await expect(checkbox).toBeEnabled();
  });
});
