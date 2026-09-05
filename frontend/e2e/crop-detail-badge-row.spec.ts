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

  // Three states: the two widest buttons — state 1 (long "In Bibliothek
  // teilen") and state 3 (published then edited -> "Kulturbibliothek
  // aktualisieren") — plus the declined-update chip, the one state that is not
  // a button.
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

  // State 2b: publish, move the public entry ahead, then decline that version.
  const declined = await apiRequest<{ id: number }>(page, 'POST', '/crops/', {
    name: `Badge declined ${Date.now()}`,
    // The publish duplicate gate keys on species + normalized variety, so this
    // must not collide with the "Testsorte" published above.
    variety: `Ablehnsorte ${Date.now()}`,
    crop_species: speciesId,
    growth_duration_days: 40,
    harvest_duration_days: 14,
  });
  const declinedPublic = await apiRequest<{ public_crop: { id: number } }>(
    page,
    'POST',
    `/crops/${declined.id}/publish-public/`,
    { accepted_public_library_terms: true, crop_species_id: speciesId, original_language_code: 'de' },
  );
  await apiRequest(page, 'PATCH', `/public-crops/${declinedPublic.public_crop.id}/`, {
    growth_duration_days: 55,
  });
  await apiRequest(page, 'POST', `/crops/${declined.id}/public-update/reject/`);

  const cases: Array<{ id: number; control: RegExp; testId?: string }> = [
    { id: unlinked.id, control: /In Bibliothek teilen/ },
    { id: published.id, control: /Bibliothek aktualisieren/ },
    { id: declined.id, control: /Update abgelehnt/, testId: 'crop-detail-library-status' },
  ];

  for (const viewport of VIEWPORTS) {
    await setViewportPreset(page, viewport);
    for (const { id, control, testId } of cases) {
      await page.goto(`/app/crops?cropId=${id}`);
      await waitForPageStable(page, /Kulturbibliothek/i);

      const badgeRow = page.getByTestId('crop-detail-badge-row');
      await expect(badgeRow).toBeVisible();
      const libraryControl = testId
        ? badgeRow.getByTestId(testId)
        : badgeRow.getByRole('button', { name: control });
      await expect(libraryControl).toBeVisible();
      await expect(libraryControl).toHaveText(control);

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

// Declining a library update is a stored decision, not just a closed dialog:
// the "Kultur aktualisieren" button has to stay gone across reloads until the
// public entry moves to a version the user never decided on.
test('declining a library update retires the button until the public entry changes again', async ({ page, request }, testInfo) => {
  await loginWithDeterministicProject(page, request, `crop-badge-decline-${testInfo.workerIndex}`);
  await page.goto('/app/crops');
  await waitForPageStable(page, /Kulturbibliothek/i);

  const species = await apiRequest<{ results: Array<{ id: number; name: string }> }>(page, 'GET', '/crop-species/');
  const speciesId = species.results[0]?.id;
  const crop = await apiRequest<{ id: number }>(page, 'POST', '/crops/', {
    name: `Badge decline ${Date.now()}`,
    variety: `Sorte ${Date.now()}`,
    crop_species: speciesId,
    growth_duration_days: 40,
    harvest_duration_days: 14,
    notes: 'v1',
  });
  const published = await apiRequest<{ public_crop: { id: number } }>(
    page,
    'POST',
    `/crops/${crop.id}/publish-public/`,
    { accepted_public_library_terms: true, crop_species_id: speciesId, original_language_code: 'de' },
  );
  // Editing the public entry directly is what puts the library ahead of the
  // linked project copy.
  await apiRequest(page, 'PATCH', `/public-crops/${published.public_crop.id}/`, {
    growth_duration_days: 55,
  });

  const badgeRow = page.getByTestId('crop-detail-badge-row');
  const pullButton = badgeRow.getByRole('button', { name: 'Kultur aktualisieren' });
  const statusChip = badgeRow.getByTestId('crop-detail-library-status');

  await page.goto(`/app/crops?cropId=${crop.id}`);
  await waitForPageStable(page, /Kulturbibliothek/i);
  await expect(pullButton).toBeVisible();

  // "Abbrechen" decides nothing: the button survives it.
  await pullButton.click();
  const dialog = page.getByRole('dialog', { name: 'Aktualisierung aus der Bibliothek' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(pullButton).toBeVisible();

  await pullButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(dialog).toBeHidden();
  await expect(pullButton).toBeHidden();
  await expect(statusChip).toHaveText('Update abgelehnt');

  // The decision is persisted, not just local dialog state.
  await page.reload();
  await waitForPageStable(page, /Kulturbibliothek/i);
  await expect(pullButton).toBeHidden();
  await expect(statusChip).toHaveText('Update abgelehnt');

  // The declined diff stays reachable from the chip.
  await statusChip.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('crop-public-update-rejected-hint')).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();

  // A further public change is a version the user never decided on, so the
  // button comes back on its own.
  await apiRequest(page, 'PATCH', `/public-crops/${published.public_crop.id}/`, {
    growth_duration_days: 60,
  });
  await page.reload();
  await waitForPageStable(page, /Kulturbibliothek/i);
  await expect(pullButton).toBeVisible();
});
