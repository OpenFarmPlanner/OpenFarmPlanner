# Agent API

How external coding agents (Codex, Claude Code, scripts, CI jobs) authenticate
against OpenFarmPlanner and import culture data safely.

There is **no separate agent API**. Agents call the same endpoints the browser
calls, backed by the same serializers, the same `Culture.clean()`, and the same
project scoping. What this feature adds is a second credential type, a set of
rules that narrow what that credential can reach, and a two-step import flow
that refuses to guess.

## Contents

- [Why a token and not `agent-login`](#why-a-token-and-not-agent-login)
- [Security model](#security-model)
- [Permissions](#permissions)
- [Getting a token](#getting-a-token)
- [Using a token (curl)](#using-a-token-curl)
- [Machine-readable schema](#machine-readable-schema)
- [Culture fields, units, and bounds](#culture-fields-units-and-bounds)
- [Validation rules](#validation-rules)
- [The two-step import flow](#the-two-step-import-flow)
- [Idempotency and duplicates](#idempotency-and-duplicates)
- [Known limitations](#known-limitations)

## Why a token and not `agent-login`

`AgentLoginToken` (`/agent-login/<token>/`) already exists, but it solves a
different problem and is not a substitute:

| | `AgentLoginToken` | `ProjectApiToken` |
|---|---|---|
| Creator | superusers only, via Django admin | any project member, from account settings |
| Effect | logs in and starts a **browser session** | authenticates a **single request** |
| Reuse | one-time | reusable until expiry or revocation |
| CSRF | required (it is a session) | not required |
| Scopes | none | `read` / `write` |
| Surface | everything the session user may do | an explicit allowlist |

`agent-login` remains what it was: a superuser convenience for opening the app
as an agent. Everything below concerns `ProjectApiToken` only.

## Security model

Five independent mechanisms, each of which would have to fail for a token to
exceed its remit.

**1. Storage.** `ProjectApiToken` keeps a SHA-256 digest and a short, non-secret
display prefix. The plaintext exists only in the HTTP response that created it.
A plain digest is appropriate here — unlike a password, the input is 256 bits of
`secrets.token_urlsafe` output, so there is no low-entropy candidate space to
enumerate and no benefit from stretching.

**2. Project binding.** `farm.project_context.get_active_project_or_400` reads
the project from the token row and never from the request when a token is
present. An `X-Project-Id` header naming a different project is *rejected* (403)
rather than ignored, so a misconfigured agent fails loudly instead of quietly
writing into the wrong place. Membership is re-checked on every request:
removing someone from a project immediately kills the tokens they made for it.

**3. Surface allowlist (middleware).** `ApiTokenSurfaceMiddleware` runs before
the view and refuses any token request whose resolved view does not declare
`api_token_actions`. It sits above DRF, so a view that sets its own
`permission_classes` — several account endpoints do — cannot accidentally opt
itself in, and neither can Django admin or any non-DRF view.

**4. Scope and action check (DRF permission).**
`ApiTokenAccessPermission` additionally verifies the specific action, refuses
`DELETE` unconditionally, and refuses unsafe methods for `read` tokens.

**5. Queryset scoping.** `ProjectScopedMixin` filters every queryset by the
active project, so a guessed object id from another project returns 404 on read
and on write alike.

Session authentication is untouched by all of this. Both authenticators are
registered; the token authenticator returns `None` unless the request carries an
`Authorization: Bearer ofp_pat_…` header, and every rule above is gated on a
token actually being present.

### CSRF

DRF views are CSRF-exempt at the middleware level; only `SessionAuthentication`
re-introduces the check. `ProjectApiTokenAuthentication` does not, so token
clients need no CSRF token. That is correct rather than a shortcut: a bearer
token is not ambiently attached by the browser, so it is not subject to
cross-site request forgery. Browser sessions keep requiring `X-CSRFToken`
exactly as before.

## Permissions

Two scopes:

| Scope | HTTP methods | May do |
|---|---|---|
| `read` | `GET`, `HEAD`, `OPTIONS` | read the bound project's data |
| `write` | `read` + `POST`, `PUT`, `PATCH` | additionally create and update cultures, and run imports |

Reachable endpoints (everything else returns 403 for tokens):

| Endpoint | `read` | `write` |
|---|---|---|
| `GET /api/cultures/`, `GET /api/cultures/{id}/` | ✅ | ✅ |
| `POST /api/cultures/`, `PATCH`/`PUT /api/cultures/{id}/` | ❌ | ✅ |
| `GET /api/cultures/duplicate-check/`, `GET /api/cultures/{id}/history/` | ✅ | ✅ |
| `POST /api/culture-imports/preview/` | ❌ | ✅ |
| `GET /api/culture-imports/{draft_id}/` | ✅ | ✅ |
| `POST /api/culture-imports/{draft_id}/apply/` | ❌ | ✅ |
| `GET /api/suppliers/`, `/seed-packages/`, `/culture-supplier-data/` | ✅ | ✅ |
| `GET /api/locations/`, `/fields/`, `/beds/`, `/planting-plans/`, `/tasks/` | ✅ | ✅ |
| `GET /api/agent/openapi.json` | ✅ | ✅ |

Explicitly **not** reachable with any token, in this version:

- every `DELETE`, including soft-deleting a culture and `undelete`
- project members, invitations, project switching, project create/delete
- account settings, `/api/auth/*`, data export, consent
- API-token management itself — a token cannot mint another token
- Django admin
- history restore endpoints
- public crop-library moderation

Opting a new endpoint in is a deliberate one-line change: add
`api_token_actions = {...}` to the view.

## Getting a token

In the app: **Account settings → API tokens for coding agents**. Choose a name,
the project, `read` or `write`, and optionally an expiry date (at most one year
out). The plaintext is shown once, in a dialog, with an explicit note that it
cannot be retrieved again. Afterwards the list shows only the display prefix
(`abcd1234…`), the status, and `last_used_at`.

Revoking is immediate and permanent; a revoked token is never reactivated.

> **Never commit a token.** Not to this repository, not to any other, not into
> an agent's configuration file that is tracked by git. Keep it in your agent's
> secret storage or an untracked environment variable. No example in this
> repository contains a real token, and none ever should.

## Using a token (curl)

Put the token in an environment variable — never on the command line, where it
lands in your shell history:

```bash
read -rs OFP_TOKEN && export OFP_TOKEN
export OFP_API="https://your-openfarmplanner-host/api"
```

Read the cultures of the bound project. No `X-Project-Id` is needed — the server
derives the project from the token:

```bash
curl -sS "$OFP_API/cultures/" \
  -H "Authorization: Bearer $OFP_TOKEN"
```

Fetch the machine-readable schema:

```bash
curl -sS "$OFP_API/agent/openapi.json" \
  -H "Authorization: Bearer $OFP_TOKEN"
```

Update one culture (requires `write`):

```bash
curl -sS -X PATCH "$OFP_API/cultures/42/" \
  -H "Authorization: Bearer $OFP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"growth_duration_days": 75}'
```

Preview an import — this writes no culture data:

```bash
curl -sS -X POST "$OFP_API/culture-imports/preview/" \
  -H "Authorization: Bearer $OFP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "source_label": "bestellung-2026.csv",
        "items": [
          {"name": "Brokkoli", "variety": "Calabrese", "row_spacing_cm": 50},
          {"name": "Karotte", "variety": "Nantaise", "row_spacing_m": 0.3}
        ]
      }'
```

The response carries `draft_id`, `checksum`, a `summary`, and the per-field
analysis. Review it, then execute exactly that draft:

```bash
curl -sS -X POST "$OFP_API/culture-imports/<draft_id>/apply/" \
  -H "Authorization: Bearer $OFP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "checksum": "<checksum from the preview>", "acknowledge_warnings": true}'
```

If a token is wrong, expired, or revoked, the API answers `401` with
`WWW-Authenticate: Bearer realm="api"`. If the token is valid but the endpoint
or scope is not, it answers `403` with a `detail` explaining which rule applied.

## Machine-readable schema

`GET /api/agent/openapi.json` returns an OpenAPI 3.1 document covering exactly
the endpoints listed above. It is **generated** from
`farm/services/culture_import/field_specs.py`, the same module the validator
reads, so a documented bound and an enforced bound cannot drift apart. A test
asserts that equivalence.

Beyond standard JSON Schema, the culture schema uses four extensions:

| Extension | Meaning |
|---|---|
| `x-unit` | the canonical unit of the value (`m`, `days`, `g`, `percent`, `kg`) |
| `x-plausible-minimum` / `x-plausible-maximum` | the ordinary range; outside it the value is accepted but warned about |
| `x-requires` | the companion field that must be sent together with this one |
| `x-accepted-input-keys` | alternative input spellings, e.g. `row_spacing_cm` for `row_spacing_m` |

`minimum` / `maximum` / `exclusiveMinimum` carry the *hard* bounds — values
outside them are rejected.

## Culture fields, units, and bounds

Distances are stored in SI metres, and the canonical field names say so:
`row_spacing_m`, `distance_within_row_m`, `sowing_depth_m`. An agent never has
to guess a unit from a field name.

The import endpoints also accept `_cm` and `_mm` spellings and convert them. The
bare spelling (`row_spacing`) carries no unit and is only usable when the value
itself states one (`"50 cm"` or `{"value": 50, "unit": "cm"}`).

| Field | Unit | Hard range | Plausible range |
|---|---|---|---|
| `row_spacing_m` | m | > 0 … 3 | 0.05 … 1.5 |
| `distance_within_row_m` | m | > 0 … 3 | 0.01 … 1.5 |
| `sowing_depth_m` | m | 0 … 0.5 | 0.002 … 0.15 |
| `growth_duration_days` | days | 0 … 1095 | 5 … 400 |
| `harvest_duration_days` | days | 0 … 730 | … 240 |
| `propagation_duration_days` | days | 0 … 365 | … 120 |
| `expected_yield` | kg | 0 … 100000 | … 500 |
| `thousand_kernel_weight_g` | g | > 0 … 2000 | 0.05 … 500 |
| `sowing_calculation_safety_percent_direct` | percent | 0 … 100 | … 50 |
| `sowing_calculation_safety_percent_pre_cultivation` | percent | 0 … 100 | … 50 |
| `seed_rate_direct_value` | see its `_unit` | > 0 … 100000 | depends on the unit |
| `seed_rate_pre_cultivation_value` | see its `_unit` | > 0 … 100000 | depends on the unit |

Seed-rate units are the project's existing vocabulary from `farm/seed_units.py`
and nothing else: `g_per_m2`, `g_per_lfm`, `seeds_per_m2`, `seeds_per_lfm`,
`seeds_per_plant`. Synonyms (`g/m²`, `Korn / Pflanze`, …) are normalized to
those five on the way in; a spelling that normalizes to nothing is rejected, so
no new unit string ever reaches the database.

Plausible seed-rate bands, applied once the unit is known:

| Unit | Plausible |
|---|---|
| `g_per_m2` | 0.01 … 100 |
| `g_per_lfm` | 0.01 … 50 |
| `seeds_per_m2` | 0.1 … 2000 |
| `seeds_per_lfm` | 0.1 … 500 |
| `seeds_per_plant` | 1 … 10 |

Enums: `nutrient_demand` (`low`/`medium`/`high`), `harvest_method`
(`per_plant`/`per_sqm`), `cultivation_types`
(`pre_cultivation`/`direct_sowing`). German spellings (`hoch`, `Anzucht`,
`Direktsaat`) are normalized; anything else is rejected.

## Validation rules

`name` is the only required field. Everything else is optional, and an absent
field is left untouched rather than reset.

Rejected (the row becomes `blocked` and the draft cannot be applied):

- a number whose unit is stated nowhere — in the key, the value, or an explicit
  `unit` member. `{"row_spacing": 30}` is **not** read as 30 m.
- an unknown unit. No conversion is invented.
- a value outside the hard range. `{"row_spacing_m": 30}` is refused as a unit
  mistake, while `{"row_spacing_cm": 30}` is accepted as 0.3 m.
- a seed-rate value without its unit, or a unit without its value.
- a seed-rate unit outside the canonical five.
- an enum value that does not normalize to an allowed value.
- a fractional day count, an invalid `#RRGGBB` colour, or an over-long text
  (which is refused, not truncated).
- a missing name.
- two rows in one payload that resolve to the same culture.

Warned about (accepted, but shown in the preview and requiring
`acknowledge_warnings` before execution):

- a value inside the hard range but outside the plausible band — an unusually
  small or large spacing, an extreme seed rate, a very long harvest window.
- a seed rate given for a cultivation type the culture does not list.

Ignored and reported, never guessed:

- keys that are not part of the culture schema. An order export's
  `article_no`, `package_size`, `price_eur`, or `order_quantity` land under
  `ignored_fields` with `code: "unknown_field"`. A `product_name` is never
  folded into `variety`, and a package size is never read as a seed rate.
- two input keys mapping to the same API field; the second is reported as
  `duplicate_key` rather than silently overriding the first.

## The two-step import flow

```
POST /api/culture-imports/preview/      →  analysis + draft_id + checksum   (no writes)
                    ↓ human or agent reviews the table
POST /api/culture-imports/{id}/apply/   →  {"confirm": true, "checksum": …}  (writes)
```

**Preview** analyzes the payload against the field specs and the project's
existing cultures, then stores the result as a `CultureImportDraft` (TTL 2
hours). It touches no culture data at all.

Per row it reports `action` (`create` / `update` / `skip` / `blocked`),
`identity`, `matched_culture_id`, `ignored_fields`, and per field:

| Key | Meaning |
|---|---|
| `source_key` | the key exactly as sent |
| `source_value` | the value exactly as sent |
| `source_unit` | the unit detected in the source, or `null` |
| `api_value` | the normalized value that would be stored, or `null` |
| `api_unit` | the canonical unit |
| `confidence` | `exact` / `converted` / `needs_clarification` / `invalid` |
| `current_value` | what is stored today, when a culture matched |
| `changes_existing` | whether applying would change it |
| `warnings`, `errors` | machine codes plus human messages |

Rendered as a table, the two cases from the specification look like this:

| Culture | Field | Source value | API value | Status |
|---|---|---:|---:|---|
| Brokkoli | `row_spacing_m` | 50 cm | 0.5 m | `converted` |
| Karotte | `seed_rate_direct_value` | 5, no unit | – | `needs_clarification` |

**Apply** re-reads the stored draft — it never re-analyzes a payload sent with
the apply call — and refuses unless all of the following hold:

| Refusal `code` | Cause |
|---|---|
| `confirmation_required` | `confirm` was not `true` |
| `checksum_mismatch` | the confirmed checksum is not this draft's |
| `draft_expired` | the draft is older than its TTL |
| `draft_has_errors` | at least one row is `blocked` |
| `warnings_not_acknowledged` | the draft has warnings and `acknowledge_warnings` was not `true` |
| `match_disappeared` | a matched culture was deleted between preview and apply |
| `execution_failed` | a serializer rejected a row; everything was rolled back |

The checksum is what turns "the preview I reviewed" into something the server
can verify rather than assume: preview and apply are separate requests, and
without it a client could confirm one analysis while a different one gets
written.

Execution runs inside a single `transaction.atomic()`. A rejection on row 7
leaves rows 1-6 unwritten — the batch was reviewed as a whole, so it is applied
as a whole.

## Idempotency and duplicates

Two layers, both aligned with the existing data model.

**Row identity** is the normalized `(name, variety, supplier)` trio, which is
exactly the `unique_culture_normalized` database constraint. A row that resolves
to an existing culture is an update, not an insert. If nothing would change, the
action is `skip` — so re-previewing and re-applying the same file converges
instead of accumulating rows. Matching is project-scoped, so a row can never
resolve to a culture in someone else's project.

Note the deliberate asymmetry: a row without a supplier only matches a culture
without a supplier. An unspecified row never overwrites a supplier-specific one.

**Draft identity** covers retries. Applying an already-applied draft performs no
writes and returns the original result with `already_applied: true`, so a client
that retries after a dropped response never doubles an import.

Duplicates *within* one payload are caught at preview time: the second row
naming the same culture is blocked with `duplicate_in_payload`.

## Known limitations

- **No deletion.** Removing a culture stays a session-authenticated action in
  the UI. Also no `undelete`, no history restore.
- **Read-only supporting data.** Suppliers, locations, fields, beds, planting
  plans, and tasks can be read but not changed with a token. An import can
  create a supplier indirectly via `supplier_name`, but there is no supplier
  write endpoint.
- **Two scopes only.** No per-resource scopes; `write` covers all writable
  culture data of the bound project.
- **One project per token.** Working across two projects means two tokens. This
  is the point, not an oversight.
- **Drafts expire after two hours** and are not garbage-collected on a schedule;
  expired rows stay in the table until someone prunes them.
- **`seed_rate_by_cultivation`, seed packages, images, and supplier rows** are
  not part of the import schema yet. They remain editable through the browser
  and, for seed packages, through the culture endpoints.
- **`last_used_at` is coalesced** to at most one write per minute, so it is
  accurate to the minute rather than the request.
- **No rate limiting specific to tokens.** The existing DRF throttles are scoped
  to named endpoints (login, registration, …) and do not cover the agent
  surface.

## Where the code lives

| Path | Contents |
|---|---|
| `backend/farm/models/agent_api.py` | `ProjectApiToken`, `CultureImportDraft` |
| `backend/farm/agent_api/authentication.py` | bearer authentication |
| `backend/farm/agent_api/permissions.py` | scope/action rules |
| `backend/farm/agent_api/middleware.py` | surface allowlist above DRF |
| `backend/farm/agent_api/views.py` | token self-service, import endpoints |
| `backend/farm/agent_api/openapi.py` | generated schema |
| `backend/farm/services/culture_import/field_specs.py` | units, bounds, enums — single source of truth |
| `backend/farm/services/culture_import/units.py` | value/unit parsing and conversion |
| `backend/farm/services/culture_import/analysis.py` | preview generation |
| `backend/farm/services/culture_import/apply.py` | transactional execution |
| `frontend/src/pages/accountSettingsApiTokensCard.tsx` | token management UI |
