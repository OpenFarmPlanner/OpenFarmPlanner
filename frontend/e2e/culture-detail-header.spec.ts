import { expect, test, type Locator } from '@playwright/test';
import { apiRequest, loginWithDeterministicProject, setViewportPreset, VIEWPORTS, waitForPageStable } from './utils';

// The Kultur detail header pins its actions top-right and lets the crop name
// wrap instead: a long name must never push "Bearbeiten"/"Anbauplan hinzufügen"
// onto a line of their own, and must never slide underneath them either.
// Asserted geometrically rather than by screenshot so the failure message says
// which of the two broke, at which viewport.
const SHORT_NAME = 'Kresse';
const LONG_NAME = 'Asiatisches Blattgemüse/Senfkohl';

// Matches ACTION_LABEL_BREAKPOINT in components/buttons/segmentedControlStyles.ts.
const LABEL_BREAKPOINT_PX = 1200;

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('keeps the Kultur header actions top-right at every viewport', async ({ page, request }, testInfo) => {
  await loginWithDeterministicProject(page, request, `culture-header-${testInfo.workerIndex}`);
  await page.goto('/app/cultures');
  await waitForPageStable(page, /Kulturbibliothek/i);

  const cultureIds: Record<string, number> = {};
  for (const name of [SHORT_NAME, LONG_NAME]) {
    const culture = await apiRequest<{ id: number }>(page, 'POST', '/cultures/', { name });
    cultureIds[name] = culture.id;
  }

  for (const viewport of VIEWPORTS) {
    await setViewportPreset(page, viewport);
    const labelsCollapsed = viewport.width < LABEL_BREAKPOINT_PX;

    for (const name of [SHORT_NAME, LONG_NAME]) {
      await page.goto(`/app/cultures?cultureId=${cultureIds[name]}`);
      await waitForPageStable(page, /Kulturbibliothek/i);

      const header = page.getByTestId('culture-detail-header');
      await expect(header).toBeVisible();
      const title = header.locator('h2, [data-testid="culture-title-selector-label"]').first();
      const editButton = header.getByRole('button', { name: 'Bearbeiten' });

      const headerBox = await boundingBox(header);
      const titleBox = await boundingBox(title);
      const editBox = await boundingBox(editButton);

      expect(
        editBox.y - headerBox.y,
        `${viewport.key}/${name}: actions were pushed below the title row`,
      ).toBeLessThan(8);
      expect(
        titleBox.x + titleBox.width,
        `${viewport.key}/${name}: the title runs underneath the actions`,
      ).toBeLessThanOrEqual(editBox.x + 1);

      const editLabel = editButton.getByTestId('detail-page-action-label');
      if (labelsCollapsed) {
        await expect(editLabel).toBeHidden();
        await editButton.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Bearbeiten');
        await page.mouse.move(0, 0);
      } else {
        await expect(editLabel).toBeVisible();
      }
    }
  }
});
