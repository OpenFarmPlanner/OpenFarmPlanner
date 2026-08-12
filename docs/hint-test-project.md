# Hint Test Project

The hint test project is a reproducible development and QA fixture for
OpenFarmPlanner states that are otherwise hard to keep visible: warnings,
tooltips, empty states, disabled-action explanations, incomplete calculations,
and intentionally incomplete project data.

It is separate from the realistic onboarding demo project. The onboarding demo
answers "what could my farm look like?", while this project answers "which UI
states still need to be inspected?"

## Create Or Reset

From the backend directory:

```bash
pdm run python manage.py create_hint_test_project
```

Default records:

- Project: `Hinweise & Sonderfälle`
- Admin user: `hint-test-openfarmplanner@example.local`
- Admin password: `OpenFarmPlannerHintTest2026!`
- Member user: `hint-test-member@example.local`
- Member password: `OpenFarmPlannerHintMember2026!`

The command is idempotent. It reuses the project with slug
`hinweise-sonderfaelle`, resets that project's farm-planning data, recreates
the fixture records, keeps the admin and member memberships, and recreates one
pending invitation. It also records the current required document consent for
the fixture users so they can enter the app directly after login. It does not
modify the onboarding demo project.

The project is a developer/test fixture. It is not exposed through production
UI actions and must not be used as realistic sample farm data.

## Fixture Design

The fixture intentionally uses speaking names so a tester can identify the
state directly in tables:

- `Saatgutmenge – Aussaatmenge fehlt`
- `Saatgutmenge – Beetfläche fehlt`
- `Saatgutmenge – Reihenabstand fehlt`
- `Saatgutmenge – Pflanzenanzahl fehlt`
- `Saatgutmenge – TKG fehlt`
- `Kultur – keine Zeitangaben`
- `Kultur – nur Wachstumszeit`
- `Kultur – Pflanzabstände fehlen`
- `Ertrag – erwarteter Ertrag fehlt`

Invalid form submissions are not persisted as invalid database rows. For those
states, the fixture provides the nearest valid data context and the inventory
below marks the remaining step as a manual input action.

## Inventory

| Area | Visible behavior / message | Data constellation | Severity | Covered | Manual path |
| --- | --- | --- | --- | --- | --- |
| Project selection | No-project onboarding / first project start | Requires user with no active projects | Info | No | Use a new account or remove all projects from a local test user |
| Project menu | Project switching, demo loading, trash entry, version history | Any existing project plus deleted project/version data | Info | Partial | Open top-right project menu; deleted project count is separate trash data |
| Project settings | Member/admin differences and disabled management actions | Admin and member users in this fixture | Info/warning | Yes | Login as admin and member, compare Settings |
| Project invitations | Pending invitation list and revoke actions | One pending invitation for `hint-test-invitation@example.local` | Info | Yes | Settings → Members / Invitations |
| Locations | Optional location details missing | `Hinweise – Standort ohne optionale Angaben` | Info | Yes | Standorte |
| Locations | Validation for required name and invalid coordinates | Valid existing locations; invalid values are rejected by form/API | Error | Manual | Edit/create a location, clear name or enter invalid coordinates |
| Fields/beds hierarchy | Missing area/dimension data | `Parzelle – Fläche fehlt`, `Beet – keine nutzbare Fläche` | Warning/info | Yes | Anbauflächen |
| Fields/beds hierarchy | Context-menu discovery hint | Per-page local preference key | Info | Data-independent | Open Anbauflächen before using row context menu |
| Graphical field view | Existing layout and missing layout contrast | Two fields/beds have layouts; one location intentionally has none | Info | Yes | Anbauflächen → graphical/layout mode |
| Crop Library | Imported vs. local and modified imported state | `Bibliothek – importiert und geändert` | Info | Yes | Kulturbibliothek → select culture detail |
| Crop Library | Missing spacing prevents plant-density calculation | `Kultur – Pflanzabstände fehlen` | Warning/info | Yes | Kulturbibliothek → details or edit dialog |
| Cultures | Duplicate supplier/culture validation | Existing suppliers and cultures provide collision targets | Error | Manual | Create duplicate supplier/culture names in the same project |
| Public library | Empty/no-result and import errors | Public library is global, not project-owned | Info/error | Manual | Open library, search for an impossible term or test import failures |
| Planting plans | Harvest start/end not computable without culture durations | `Kultur – keine Zeitangaben` | Warning/info | Yes | Anbaupläne |
| Planting plans | Harvest end not computable when only harvest duration is missing | `Kultur – nur Wachstumszeit` | Warning/info | Yes | Anbaupläne |
| Planting plans | Fully computable timing reference | `Kultur – vollständige Zeitangaben` | Reference | Yes | Anbaupläne |
| Planting plans | Draft/incomplete row behavior | `Entwurf – Kultur und Datum fehlen` | Info/warning | Yes | Anbaupläne |
| Planting plans | Area conflict / overbooking warning context | `Beet – überbelegt` has overlapping plans | Warning | Yes | Anbaupläne, edit area/date on overlapping rows |
| Gantt/calendar | Plans with missing timing cannot create full active spans | Timing fixture cultures above | Warning/info | Yes | Gantt / Belegungskalender |
| Gantt/calendar | Empty filtered result | Any populated project, impossible filter/search | Info | Manual | Apply filters that match nothing |
| Seed demand | Fully calculable row with package suggestion | `Saatgutmenge – vollständig berechenbar` | Reference | Yes | Saatgutbedarf |
| Seed demand | Missing seed rate | `Saatgutmenge – Aussaatmenge fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Missing area for m² rate | `Saatgutmenge – Beetfläche fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Missing row spacing for lfm rate | `Saatgutmenge – Reihenabstand fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Missing quantity for seeds-per-plant rate | `Saatgutmenge – Pflanzenanzahl fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Missing TKG conversion | `Saatgutmenge – TKG fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Missing supplier data | `Saatgutmenge – Lieferant fehlt` | Warning | Yes | Saatgutbedarf |
| Seed demand | Multiple supplier choices, no persisted choice | `Saatgutmenge – Lieferant auswählen` | Info/action | Yes | Saatgutbedarf |
| Seed demand | Supplier-specific TKG overrides culture TKG | `Saatgutmenge – Lieferanten-TKG überschreibt Kultur` | Reference | Yes | Saatgutbedarf |
| Seed demand | Germination rate increases demand | `Saatgutmenge – Keimrate erhöht Bedarf` | Reference | Yes | Saatgutbedarf |
| Suppliers | Empty supplier/product-order details | `Lieferant – ohne Bestellinformationen` and related culture data | Info | Yes | Lieferanten and Saatgutbedarf |
| Suppliers | Duplicate supplier/invalid URL validation | Existing suppliers provide collision targets | Error | Manual | Lieferanten → create duplicate or invalid URL |
| Yield overview | Missing expected yield/harvest method | `Ertrag – erwarteter Ertrag fehlt` | Warning/info | Yes | Ertragsübersicht |
| Filters/search | No matching rows | Any table with seeded rows | Info | Manual | Enter a deliberately impossible search term |
| API/network errors | Load/save/delete failure alerts | Requires mocked failing request or backend outage | Error | Manual/test | Use frontend tests or intercept requests in browser dev tools |
| Version history | Empty/history list and restore feedback | Culture creation creates revisions; empty history requires separate fresh object | Info | Partial | Open project history or culture history |

## Backend Assertions

The backend test suite verifies the important fixture guarantees:

- project creation and memberships
- idempotency without duplicate rows
- pending invitation recreation
- seed-demand warning states
- complete, missing, and partial culture-duration calculations
- missing spacing / imported-modified flags
- isolation from the normal demo project

Run the focused tests with:

```bash
pdm run test farm/tests/test_hint_test_project.py
```
