import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loginWithDeterministicProject, waitForPageStable } from './utils';

const viewport = { width: 1440, height: 900 };
const screenshotDir = path.resolve(process.cwd(), 'public/landing/screenshots');
const tempDir = path.resolve(process.cwd(), 'test-results/landing-screenshots');
const magickBinary = process.env.MAGICK_BINARY ?? 'magick';

const screenshots = [
  {
    key: 'areas',
    path: '/app/fields-beds',
    ready: /Hofgarten|Acker am Bach/i,
    filename: 'demo-areas.webp',
    fieldsViewMode: 'table',
  },
  {
    key: 'cultures',
    path: '/app/cultures',
    ready: /Kulturbibliothek|Karotte/i,
    filename: 'demo-cultures.webp',
  },
  {
    key: 'calendar',
    path: '/app/gantt-chart?view=occupancy',
    ready: /Anbaukalender|Anbauflächen/i,
    filename: 'demo-calendar.webp',
  },
  {
    key: 'yield-overview',
    path: '/app/yield-overview',
    ready: /Ertragsübersicht|Ertragsverteilung|Ertragsprognose/i,
    filename: 'demo-yield-overview.webp',
  },
  {
    key: 'seed-demand',
    path: '/app/seed-demand',
    ready: /Saatgutbedarf|Karotte/i,
    filename: 'demo-seed-demand.webp',
  },
  {
    key: 'planting-plans',
    path: '/app/anbauplaene',
    ready: /Anbaupläne|Anbauplan/i,
    filename: 'demo-planting-plans.webp',
    // Hide the computed harvest-date columns so the screenshot has room to
    // breathe and focuses on the columns a user actually edits.
    columnVisibility: { harvest_date: false, harvest_end_date: false },
  },
] as const;

async function disableTransientUi(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

function convertToWebp(sourcePng: string, targetWebp: string): void {
  execFileSync(magickBinary, [
    sourcePng,
    '-strip',
    '-resize',
    '1280x',
    '-quality',
    '82',
    targetWebp,
  ]);
}

// This is an asset-generation workflow, not a regression baseline test. It
// writes the landing-page screenshots used by HomePage from a deterministic
// demo project so product visuals can be refreshed after intentional UI work.
test.describe('landing page product screenshots', () => {
  test.skip(process.env.GENERATE_LANDING_SCREENSHOTS !== '1', 'Set GENERATE_LANDING_SCREENSHOTS=1 to refresh landing-page assets.');

  test('generates optimized demo screenshots', async ({ page, request }) => {
    try {
      execFileSync(magickBinary, ['-version'], { stdio: 'ignore' });
    } catch {
      test.skip(true, 'ImageMagick is required to convert screenshots to WebP.');
    }
    mkdirSync(screenshotDir, { recursive: true });
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });

    await page.setViewportSize(viewport);
    await loginWithDeterministicProject(page, request, 'landing-screenshots', {
      demoProject: true,
      loginAsAdmin: true,
    });
    const currentUserId = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me/', { credentials: 'include' });
      const payload = await response.json() as { id?: number };
      return payload.id ?? null;
    });
    await page.evaluate((userId) => {
      const contexts = ['fieldsBeds', 'plantingPlans', 'seedDemand', 'suppliers'];
      contexts.forEach((contextKey) => {
        window.localStorage.setItem(`ofp.contextMenuHintDismissed:context:${contextKey}`, '1');
        if (userId !== null) {
          window.localStorage.setItem(`ofp.contextMenuHintDismissed:user:${userId}:context:${contextKey}`, '1');
        }
      });
    }, currentUserId);

    for (const item of screenshots) {
      await page.evaluate((fieldsViewMode) => {
        window.localStorage.setItem('fieldsBedsViewMode', fieldsViewMode ?? 'table');
      }, 'fieldsViewMode' in item ? item.fieldsViewMode : undefined);
      if ('columnVisibility' in item) {
        await page.evaluate((columnVisibility) => {
          window.localStorage.setItem('tableColumns.plantingPlans', JSON.stringify(columnVisibility));
        }, item.columnVisibility);
      }
      await page.goto(item.path);
      await disableTransientUi(page);
      await waitForPageStable(page, item.ready);
      await page.mouse.move(0, 0);

      if (item.key === 'areas') {
        await expect(page.getByRole('button', { name: 'Liste', pressed: true })).toBeVisible();
        // Open a field row's length cell in edit mode so the screenshot makes the
        // grid's inline editing affordance obvious at a glance (locations themselves
        // aren't editable for this column, so target a field/bed row by name).
        const lengthCell = page.locator('[role="row"]', { hasText: 'Kohlquartier' })
          .locator('[role="gridcell"][data-field="length_m"]');
        await expect(lengthCell).toBeVisible();
        await lengthCell.dblclick();
        await expect(page.locator('.MuiDataGrid-cell--editing input').first()).toBeVisible();
      }

      if (item.key === 'calendar') {
        await expect(page.locator('[data-testid="gantt-virtual-viewport"]')).toBeVisible();
        await page.locator('.gantt-container-wrapper .rmg-container').evaluate((element) => {
          element.scrollLeft = 0;
        });
      }

      if (item.key === 'planting-plans') {
        // Open the first row's planting-date cell in edit mode so the screenshot
        // makes the grid's inline editing affordance obvious at a glance.
        const dateCell = page.locator('[role="gridcell"][data-field="planting_date"]').first();
        await expect(dateCell).toBeVisible();
        await dateCell.dblclick();
        await expect(page.locator('.MuiDataGrid-cell--editing input').first()).toBeVisible();
      }

      const pngPath = path.join(tempDir, `${item.key}.png`);
      await page.screenshot({
        path: pngPath,
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
      });
      convertToWebp(pngPath, path.join(screenshotDir, item.filename));
    }
  });
});
