import { expect, test, type Locator, type Page } from '@playwright/test';

// Functional assertions rather than a screenshot baseline: what matters here is
// a geometric relation (the logo's centre matches the viewport's centre, and it
// does not move when the language changes), which a pixel diff would only cover
// indirectly and would have to be re-baselined for every unrelated landing-page
// tweak.
const viewports = [
  { key: 'mobile', width: 375, height: 800 },
  { key: 'tablet', width: 768, height: 900 },
  { key: 'desktop', width: 1440, height: 900 },
];

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function header(page: Page): Locator {
  return page.locator('header');
}

function logo(page: Page): Locator {
  // The logo row is the icon plus the "OpenFarmPlanner" heading.
  return header(page).locator('h1').locator('..');
}

function languageButton(page: Page): Locator {
  return header(page).getByRole('button', { name: /Sprache|language/i });
}

test.describe('landing page header', () => {
  for (const viewport of viewports) {
    test(`centers the logo across the viewport at ${viewport.key}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('header h1')).toHaveText('OpenFarmPlanner');

      const logoBox = await boundingBox(logo(page));
      const languageBox = await boundingBox(languageButton(page));

      // Centred on the viewport, not merely inside the space the language
      // selector leaves over. One pixel of slack for sub-pixel rounding.
      expect(Math.abs(logoBox.x + logoBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);

      // Same row, selector on the right, and the two never touch.
      expect(languageBox.x).toBeGreaterThan(logoBox.x + logoBox.width);
      expect(languageBox.y).toBeLessThan(logoBox.y + logoBox.height);
      expect(logoBox.y).toBeLessThan(languageBox.y + languageBox.height);

      const headerBox = await boundingBox(header(page));
      expect(headerBox.x + headerBox.width - (languageBox.x + languageBox.width)).toBeLessThanOrEqual(2);
      // A single row, not a header that grew a second one.
      expect(headerBox.height).toBeLessThanOrEqual(64);
    });
  }

  test('keeps the logo in place when the language changes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await expect(page.locator('header h1')).toHaveText('OpenFarmPlanner');

    const before = await boundingBox(logo(page));

    await languageButton(page).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(languageButton(page)).toHaveText(/English/);

    const after = await boundingBox(logo(page));
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);

    // Still reachable and still opening its menu after the switch.
    await languageButton(page).click();
    await expect(page.getByRole('menuitemradio', { name: 'Deutsch' })).toBeVisible();
  });
});
