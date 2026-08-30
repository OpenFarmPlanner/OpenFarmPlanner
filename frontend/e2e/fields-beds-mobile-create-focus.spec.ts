import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiRequest, loginWithDeterministicProject } from './utils';

type LocationResponse = { id: number };
type FieldResponse = { id: number; name: string };

async function createTwoParcelRows(page: Page, prefix: string): Promise<{
  firstField: FieldResponse;
  secondField: FieldResponse;
}> {
  const location = await apiRequest<LocationResponse>(page, 'POST', '/locations/', { name: `${prefix} Standort` });
  const firstField = await apiRequest<FieldResponse>(page, 'POST', '/fields/', {
    name: `${prefix} Parzelle A`,
    location: location.id,
  });
  const secondField = await apiRequest<FieldResponse>(page, 'POST', '/fields/', {
    name: `${prefix} Parzelle B`,
    location: location.id,
  });

  return { firstField, secondField };
}

async function tapCell(page: Page, cell: Locator): Promise<void> {
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function replaceFocusedInputText(page: Page, value: string): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(value);
}

test.describe('fields-beds mobile create focus', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('a single tap moves from a new parcel name to length editing', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'fields-mobile-create-focus', { loginAsAdmin: true });
    await page.goto('/app/fields-beds?action=add-parcel');

    const editRow = page.locator('.MuiDataGrid-row--editing').first();
    const nameInput = editRow.locator('[data-field="name"] input');
    await expect(nameInput).toBeFocused({ timeout: 10_000 });
    await nameInput.fill('Mobile Fokus Parzelle');

    const lengthCell = editRow.locator('[role="gridcell"][data-field="length_m"]');
    await expect(lengthCell).toBeVisible();
    await tapCell(page, lengthCell);

    const lengthInput = page.locator('.MuiDataGrid-row--editing [data-field="length_m"] input').first();
    await expect(lengthInput).toBeFocused({ timeout: 10_000 });
    await lengthInput.fill('12');
    await expect(lengthInput).toHaveValue('12');
  });

  test('the first tap on another row only ends the current row edit', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'fields-mobile-cross-row-edit', { loginAsAdmin: true });
    const { firstField, secondField } = await createTwoParcelRows(page, 'Mobile Cross Row');

    await page.goto('/app/fields-beds');
    const firstNameCell = page.locator(`[role="row"][data-id="field-${firstField.id}"] [role="gridcell"][data-field="name"]`);
    const secondNameCell = page.locator(`[role="row"][data-id="field-${secondField.id}"] [role="gridcell"][data-field="name"]`);
    await expect(firstNameCell).toBeVisible();
    await expect(secondNameCell).toBeVisible();

    await tapCell(page, firstNameCell);
    const firstInput = page.locator('.MuiDataGrid-row--editing [data-field="name"] input').first();
    await expect(firstInput).toBeFocused();
    await replaceFocusedInputText(page, 'Mobile Cross Row Parzelle A edited');
    await page.waitForTimeout(100);

    const saveFirstRow = page.waitForResponse((response) => (
      response.url().includes(`/api/fields/${firstField.id}/`)
      && response.request().method() === 'PUT'
      && response.status() === 200
    ));
    await tapCell(page, secondNameCell);
    await saveFirstRow;

    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0);

    await tapCell(page, secondNameCell);
    const secondInput = page.locator('.MuiDataGrid-row--editing [data-field="name"] input').first();
    await expect(secondInput).toBeFocused();
    await expect(secondInput).toHaveValue(secondField.name);
  });

  test('the persistent row actions button opens the existing context menu', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'fields-mobile-context-menu-button', { loginAsAdmin: true });
    const { secondField } = await createTwoParcelRows(
      page,
      'Mobile Context Menu Long Parcel Name',
    );

    await page.goto('/app/fields-beds');
    const secondRow = page.locator(`[role="row"][data-id="field-${secondField.id}"]`);
    await expect(secondRow).toBeVisible();

    const actionsButton = secondRow.getByRole('button', { name: 'Aktionen' });
    await expect(actionsButton).toBeVisible();
    const actionsButtonBox = await actionsButton.boundingBox();
    expect(actionsButtonBox).not.toBeNull();
    expect(actionsButtonBox!.x + actionsButtonBox!.width).toBeLessThanOrEqual(390);
    await tapCell(page, actionsButton);

    await expect(page.getByRole('menuitem', { name: /^Beet hinzufügen/ })).toBeVisible();
    await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0);
  });
});

test.describe('fields-beds desktop cross-row editing', () => {
  test('clicking another row still saves the current row and immediately edits the clicked row', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'fields-desktop-cross-row-edit', { loginAsAdmin: true });
    const { firstField, secondField } = await createTwoParcelRows(page, 'Desktop Cross Row');

    await page.goto('/app/fields-beds');
    const firstNameCell = page.locator(`[role="row"][data-id="field-${firstField.id}"] [role="gridcell"][data-field="name"]`);
    const secondNameCell = page.locator(`[role="row"][data-id="field-${secondField.id}"] [role="gridcell"][data-field="name"]`);
    await expect(firstNameCell).toBeVisible();
    await expect(secondNameCell).toBeVisible();

    await firstNameCell.click();
    const firstInput = page.locator('.MuiDataGrid-row--editing [data-field="name"] input').first();
    await expect(firstInput).toBeFocused();
    await replaceFocusedInputText(page, 'Desktop Cross Row Parzelle A edited');
    await page.waitForTimeout(100);

    const saveFirstRow = page.waitForResponse((response) => (
      response.url().includes(`/api/fields/${firstField.id}/`)
      && response.request().method() === 'PUT'
      && response.status() === 200
    ));
    await secondNameCell.click();
    await saveFirstRow;

    const secondEditingRow = page.locator(`[role="row"][data-id="field-${secondField.id}"].MuiDataGrid-row--editing`);
    await expect(secondEditingRow).toBeVisible();
    const secondInput = secondEditingRow.locator('[data-field="name"] input');
    await expect(secondInput).toHaveValue(secondField.name);
  });
});
