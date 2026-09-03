import { expect, test } from '@playwright/test';
import { apiRequest, loginWithDeterministicProject, setViewportPreset, VIEWPORTS, waitForPageStable } from './utils';

// The Kultur/Sorte detail badge row now also carries the public-library
// publish/update action as a button. On the narrow viewports that button plus
// the badges and the up-to-date marker must wrap onto more rows rather than
// overflow the card horizontally.
test('the crop detail badge row wraps instead of overflowing at every viewport', async ({ page, request }, testInfo) => {
  await loginWithDeterministicProject(page, request, `crop-badge-row-${testInfo.workerIndex}`);
  await page.goto('/app/crops');
  await waitForPageStable(page, /Kulturbibliothek/i);

  // A published crop shows the longest button label ("Kulturbibliothek
  // aktualisieren") plus the up-to-date marker — the widest the row gets.
  const species = await apiRequest<{ results: Array<{ id: number }> }>(page, 'GET', '/crop-species/');
  const speciesId = species.results[0]?.id;
  const crop = await apiRequest<{ id: number }>(page, 'POST', '/crops/', {
    name: `Fruchtfolge-Badge ${Date.now()}`,
    variety: 'Testsorte',
    crop_species: speciesId,
    growth_duration_days: 40,
    harvest_duration_days: 14,
    notes: 'Badge row overflow check.',
  });
  await apiRequest(page, 'POST', `/crops/${crop.id}/publish-public/`, {
    accepted_public_library_terms: true,
    crop_species_id: speciesId,
    original_language_code: 'de',
  });

  for (const viewport of VIEWPORTS) {
    await setViewportPreset(page, viewport);
    await page.goto(`/app/crops?cropId=${crop.id}`);
    await waitForPageStable(page, /Kulturbibliothek/i);

    const badgeRow = page.getByTestId('crop-detail-badge-row');
    await expect(badgeRow).toBeVisible();
    await expect(badgeRow.getByRole('button', { name: 'Kulturbibliothek aktualisieren' })).toBeVisible();

    // The row and the whole page must not scroll sideways.
    const overflow = await badgeRow.evaluate((el) => ({
      row: el.scrollWidth - el.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.row, `${viewport.key}: badge row overflows horizontally`).toBeLessThanOrEqual(1);
    expect(overflow.page, `${viewport.key}: the page scrolls horizontally`).toBeLessThanOrEqual(1);

    // Every child sits within the row's box (i.e. it really wrapped).
    const childrenFit = await badgeRow.evaluate((el) => {
      const rowRect = el.getBoundingClientRect();
      return Array.from(el.children).every((child) => {
        const r = child.getBoundingClientRect();
        return r.left >= rowRect.left - 1 && r.right <= rowRect.right + 1;
      });
    });
    expect(childrenFit, `${viewport.key}: a badge-row item spills outside the row`).toBe(true);
  }
});
