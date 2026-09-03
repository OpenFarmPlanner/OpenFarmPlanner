import { expect, test } from '@playwright/test';
import { apiRequest, loginWithDeterministicProject, setViewportPreset, VIEWPORTS, waitForPageStable } from './utils';

// The Kultur/Sorte detail badge row carries the single public-library action
// (CropLibraryActionButton). On the narrow viewports its long German labels
// plus the "Importiert" badge must wrap onto more rows rather than overflow the
// card horizontally.
test('the crop detail badge row wraps instead of overflowing at every viewport', async ({ page, request }, testInfo) => {
  await loginWithDeterministicProject(page, request, `crop-badge-row-${testInfo.workerIndex}`);
  await page.goto('/app/crops');
  await waitForPageStable(page, /Kulturbibliothek/i);

  const species = await apiRequest<{ results: Array<{ id: number }> }>(page, 'GET', '/crop-species/');
  const speciesId = species.results[0]?.id;

  // Two of the widest states: state 1 (long "In Bibliothek teilen"
  // button) and state 3 (published then edited -> "Kulturbibliothek
  // aktualisieren" button).
  const unlinked = await apiRequest<{ id: number }>(page, 'POST', '/crops/', {
    name: `Badge unlinked ${Date.now()}`,
    growth_duration_days: 30,
    harvest_duration_days: 10,
  });
  const published = await apiRequest<{ id: number }>(page, 'POST', '/crops/', {
    name: `Badge published ${Date.now()}`,
    variety: 'Testsorte',
    crop_species: speciesId,
    growth_duration_days: 40,
    harvest_duration_days: 14,
    notes: 'v1',
  });
  await apiRequest(page, 'POST', `/crops/${published.id}/publish-public/`, {
    accepted_public_library_terms: true,
    crop_species_id: speciesId,
    original_language_code: 'de',
  });
  await apiRequest(page, 'PATCH', `/crops/${published.id}/`, { notes: 'v2 local edit' });

  const cases: Array<{ id: number; button: RegExp }> = [
    { id: unlinked.id, button: /In Bibliothek teilen/ },
    { id: published.id, button: /Bibliothek aktualisieren/ },
  ];

  for (const viewport of VIEWPORTS) {
    await setViewportPreset(page, viewport);
    for (const { id, button } of cases) {
      await page.goto(`/app/crops?cropId=${id}`);
      await waitForPageStable(page, /Kulturbibliothek/i);

      const badgeRow = page.getByTestId('crop-detail-badge-row');
      await expect(badgeRow).toBeVisible();
      await expect(badgeRow.getByRole('button', { name: button })).toBeVisible();

      const overflow = await badgeRow.evaluate((el) => ({
        row: el.scrollWidth - el.clientWidth,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow.row, `${viewport.key}/${id}: badge row overflows horizontally`).toBeLessThanOrEqual(1);
      expect(overflow.page, `${viewport.key}/${id}: the page scrolls horizontally`).toBeLessThanOrEqual(1);

      const childrenFit = await badgeRow.evaluate((el) => {
        const rowRect = el.getBoundingClientRect();
        return Array.from(el.children).every((child) => {
          const r = child.getBoundingClientRect();
          return r.left >= rowRect.left - 1 && r.right <= rowRect.right + 1;
        });
      });
      expect(childrenFit, `${viewport.key}/${id}: a badge-row item spills outside the row`).toBe(true);
    }
  }
});
