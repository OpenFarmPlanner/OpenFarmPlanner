import { expect, test } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

test.describe('planting plans area assignment dialog', () => {
  test('keeps the desktop field hierarchy editor compact without internal scrolling', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginWithDeterministicProject(page, request, 'planting-plans-area-dialog-layout', {
      demoProject: true,
      loginAsAdmin: true,
    });

    await page.goto('/app/planting-plans');
    await expect(page.getByRole('heading', { name: 'Anbaupläne' })).toBeVisible();
    await expect(page.locator('[role="gridcell"][data-field="bed"]').first()).toBeVisible();

    await page.locator('[role="gridcell"][data-field="bed"]').first().click();
    await page.getByLabel('Anbaufläche bearbeiten').click();

    const dialog = page.getByRole('dialog', { name: 'Anbaufläche ändern' });
    await expect(dialog).toBeVisible();

    const metrics = await dialog.evaluate((dialogElement) => {
      const content = dialogElement.querySelector<HTMLElement>('.MuiDialogContent-root');
      const controls = Array.from(dialogElement.querySelectorAll<HTMLElement>('.MuiFormControl-root'))
        .map((element) => element.getBoundingClientRect());
      const gaps = controls.slice(1).map((rect, index) => rect.top - controls[index].bottom);

      return {
        contentClientHeight: content?.clientHeight ?? 0,
        contentScrollHeight: content?.scrollHeight ?? 0,
        controlHeights: controls.map((rect) => rect.height),
        gaps,
      };
    });

    expect(metrics.controlHeights).toHaveLength(3);
    for (const height of metrics.controlHeights) {
      expect(height).toBeLessThan(72);
    }
    for (const gap of metrics.gaps) {
      expect(gap).toBeLessThan(32);
    }
    expect(metrics.contentScrollHeight - metrics.contentClientHeight).toBeLessThanOrEqual(1);
  });
});
