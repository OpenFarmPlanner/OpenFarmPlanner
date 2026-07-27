import { expect, test } from '@playwright/test';

test('starts the public guest demo and keeps the user in the app', async ({ page }) => {
  let publicAuthProbeCount = 0;

  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/me/')) {
      publicAuthProbeCount += 1;
    }
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' })).toBeVisible();
  expect(publicAuthProbeCount).toBe(0);

  await page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' }).click();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();
});

test('returns guest demo sessions to the public landing page when leaving the demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' }).click();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();

  await page.getByRole('button', { name: 'Mehr' }).click();
  await page.getByRole('menuitem', { name: 'Demo verlassen' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrieren' })).toBeVisible();
});

test('keeps the guest demo after an older login-page auth refresh finishes', async ({ page }) => {
  let releaseAuthRefresh: () => void = () => {};
  const authRefreshReleased = new Promise<void>((resolve) => {
    releaseAuthRefresh = resolve;
  });
  let authRefreshCount = 0;

  await page.route('**/api/auth/me/', async (route) => {
    authRefreshCount += 1;
    if (authRefreshCount === 1) {
      await authRefreshReleased;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' }).click();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  releaseAuthRefresh();
  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('openfarmplanner:authentication-expired', {
      detail: { requestStartedAt: Date.now() - 10_000 },
    }));
  });

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();
});
