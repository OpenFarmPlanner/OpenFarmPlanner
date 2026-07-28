# QA Coverage — 2026-07-23

Targeted public culture publishing-flow audit based on Git commit `9cf48784`
on branch `fix/simplify-publishing-wizard`.

## Audited areas

| Area | Viewports | Result |
|---|---|---|
| Culture publishing dialog | 1440x900, 390x844 | simplified dialog stays compact; summary/checklist/license are hidden initially |
| Official crop species selection | 1440x900 | seeded species list is available; `Tomate` can be selected |
| License reveal timing | 1440x900 | license checkbox appears only after publish readiness checks pass |
| Successful publication | 1440x900 | publication completes and shows the success snackbar |
| Duplicate check | 1440x900 | same species + variety blocks publication with an inline duplicate warning |
| Post-publish culture action menu | 1440x900 | stale state found during audit; fixed by refreshing the culture list after successful publish |
| Mobile publishing dialog | 390x844 | dialog remains centered and compact at about 326x445 px |

## Findings

- During the initial audit, the selected project culture was not refreshed
  after a successful publication, so the action menu stayed on the
  pre-publication actions until reload. The follow-up implementation refreshes
  the culture list after successful publishing so the update/withdraw actions
  become available immediately.

## Verification

- Temporary Playwright QA spec using the repository E2E fixture endpoint.
- Follow-up temporary Playwright spec verified that the menu refreshes
  immediately after publishing, without a page reload.
- Frontend/backend served through the standard Playwright web-server setup.
- No temporary QA spec or generated Playwright artifacts are tracked.

---

Targeted public crop-library collaboration-page audit based on Git commit
`49626ba3` plus the follow-up working-tree fixes on branch
`fix/simplify-publishing-wizard`.

## Audited areas

| Area | Viewports | Result |
|---|---|---|
| Full crop-library page | 1440x900, 390x844 | page loads, search/list/detail stay usable |
| Public culture import from full page | 1440x900 | published E2E culture imports into the active project |
| Discussion flow | 1440x900 | comment can be created and appears immediately |
| Change proposal flow | 1440x900 | field-based proposal can be created and appears with status `Offen` |
| Mobile crop-library layout | 390x844 | result list is capped before details; tabs no longer depend on icon-heavy labels |
| Crop-library card layout | 1440x900, 390x844 | list and detail areas render as contained cards with clearer selected state |

## Findings

- Local load errors on `/comments/` and `/change-proposals/` were caused by
  unapplied migration `farm.0079_publicculturechangeproposal_and_more`.
  Applying the migration fixed the 500 responses.
- The mobile page let the result list grow too tall before the selected
  details, which made the workflow feel buried on phones.
- The proposal form only allowed note changes. The flow now supports field
  proposals for notes, seed supplier, growth duration, and harvest duration.
- The proposal field selector needed an explicit accessible label for robust
  keyboard/test access.

## Verification

- `cd frontend && npx eslint src/crops/pages/PublicCropLibraryPage.tsx e2e/public-crop-library.spec.ts`
- `jq empty frontend/src/i18n/locales/de/cultures.json frontend/src/i18n/locales/en/cultures.json`
- `cd frontend && npm run build`
- `cd frontend && npx playwright test e2e/public-crop-library.spec.ts`
