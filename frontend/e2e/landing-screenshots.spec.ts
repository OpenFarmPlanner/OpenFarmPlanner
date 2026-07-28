import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loginWithDeterministicProject, waitForPageStable } from './utils';

const viewport = { width: 1440, height: 900 };
const screenshotDir = path.resolve(process.cwd(), 'public/landing/screenshots');
const tempDir = path.resolve(process.cwd(), 'test-results/landing-screenshots');
const magickBinary = process.env.MAGICK_BINARY ?? 'magick';

type ScreenshotLanguage = 'de' | 'en';

const screenshots = [
  {
    key: 'areas',
    path: '/app/fields-beds',
    ready: {
      de: /Hofgarten|Acker am Bach/i,
      en: /Farm Garden|Creekside Field/i,
    },
    filenames: {
      de: 'demo-areas.webp',
      en: 'demo-areas-en.webp',
    },
    fieldsViewMode: 'table',
  },
  {
    key: 'cultures',
    path: '/app/cultures',
    ready: {
      de: /Kulturbibliothek|Karotte/i,
      en: /Crop library|Carrot/i,
    },
    filenames: {
      de: 'demo-cultures.webp',
      en: 'demo-cultures-en.webp',
    },
  },
  {
    key: 'calendar',
    path: '/app/gantt-chart?view=occupancy',
    ready: {
      de: /Anbaukalender|Anbauflächen/i,
      en: /Planting calendar|Growing areas/i,
    },
    filenames: {
      de: 'demo-calendar.webp',
      en: 'demo-calendar-en.webp',
    },
  },
  {
    key: 'yield-overview',
    path: '/app/yield-overview',
    ready: {
      de: /Ertragsübersicht|Ertragsverteilung|Ertragsprognose/i,
      en: /Yield overview|Yield distribution|Yield forecast/i,
    },
    filenames: {
      de: 'demo-yield-overview.webp',
      en: 'demo-yield-overview-en.webp',
    },
  },
  {
    key: 'seed-demand',
    path: '/app/seed-demand',
    ready: {
      de: /Saatgutbedarf|Karotte/i,
      en: /Seed demand|Carrot/i,
    },
    filenames: {
      de: 'demo-seed-demand.webp',
      en: 'demo-seed-demand-en.webp',
    },
  },
  {
    key: 'planting-plans',
    path: '/app/anbauplaene',
    ready: {
      de: /Anbaupläne|Anbauplan/i,
      en: /Planting plans|Planting plan/i,
    },
    filenames: {
      de: 'demo-planting-plans.webp',
      en: 'demo-planting-plans-en.webp',
    },
    // Hide the computed harvest-date columns so the screenshot has room to
    // breathe and focuses on the columns a user actually edits.
    columnVisibility: { harvest_date: false, harvest_end_date: false },
  },
] as const;

const languages: ScreenshotLanguage[] = ['de', 'en'];

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

async function setUiLanguage(page: Page, language: ScreenshotLanguage): Promise<void> {
  await page.evaluate(async (uiLanguage) => {
    const csrfToken = document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '';
    const response = await fetch('/api/auth/account/language/', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'Accept-Language': uiLanguage,
      },
      body: JSON.stringify({ ui_language: uiLanguage }),
    });
    if (!response.ok) {
      throw new Error(`Could not switch UI language to ${uiLanguage}: ${response.status}`);
    }
    window.localStorage.setItem('ui.language', uiLanguage);
  }, language);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function hideContextMenuHints(page: Page): Promise<void> {
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
}

async function waitForScreenshotReady(page: Page, readyPattern: RegExp): Promise<void> {
  await waitForPageStable(page, readyPattern);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
}

// This is an asset-generation workflow, not a regression baseline test. It
// writes the landing-page screenshots used by HomePage from a deterministic
// demo project so product visuals can be refreshed after intentional UI work.
test.describe('landing page product screenshots', () => {
  test.skip(process.env.GENERATE_LANDING_SCREENSHOTS !== '1', 'Set GENERATE_LANDING_SCREENSHOTS=1 to refresh landing-page assets.');
  test.setTimeout(180_000);

  test('generates optimized bilingual demo screenshots', async ({ page, request }) => {
    try {
      execFileSync(magickBinary, ['-version'], { stdio: 'ignore' });
    } catch {
      test.skip(true, 'ImageMagick is required to convert screenshots to WebP.');
    }
    mkdirSync(screenshotDir, { recursive: true });
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });

    for (const language of languages) {
      await page.context().clearCookies();
      await page.goto('/');
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.setViewportSize(viewport);
      await loginWithDeterministicProject(page, request, `landing-screenshots-${language}`, {
        demoProject: true,
        loginAsAdmin: true,
        languageCode: language,
      });
      await setUiLanguage(page, language);
      await hideContextMenuHints(page);

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
        await waitForScreenshotReady(page, item.ready[language]);

        if (item.key === 'areas') {
          await expect(page.getByRole('button', { name: language === 'de' ? 'Liste' : 'List', pressed: true })).toBeVisible();
        }

        if (item.key === 'calendar') {
          await expect(page.locator('[data-testid="gantt-virtual-viewport"]')).toBeVisible();
          await page.locator('.gantt-container-wrapper .rmg-container').evaluate((element) => {
            element.scrollLeft = 0;
          });
        }

        const pngPath = path.join(tempDir, `${item.key}-${language}.png`);
        await page.screenshot({
          path: pngPath,
          fullPage: false,
          animations: 'disabled',
          caret: 'hide',
        });
        convertToWebp(pngPath, path.join(screenshotDir, item.filenames[language]));
      }
    }
  });
});
