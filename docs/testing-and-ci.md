# Testing and CI Topology

How the automated suites are split across CI jobs, why they are split that
way, and what to check before adding to them. For what to test and which
gates to run locally, see the "Testing Rules" section of
[`CLAUDE.md`](../CLAUDE.md).

## The jobs

`.github/workflows/ci.yml` runs on every pull request and on pushes to
`main`:

| Job | What it runs | Roughly |
| --- | --- | --- |
| `frontend-tests (shard 1/2)` | `vitest run --shard=1/2` | ~2 min |
| `frontend-tests (shard 2/2)` | `vitest run --shard=2/2` | ~3.5 min |
| `backend-tests` | `pytest` (xdist, with coverage) | ~6.5 min |
| `quality` | ruff, radon, ESLint, madge | ~4.5 min |

`.github/workflows/e2e.yml` runs the Playwright suite against a production
build on pull requests, split across two shards of its own.

All jobs run concurrently, so the pipeline is as long as its slowest job.

## Frontend: sharded, and parallel within a shard

Two independent things make the frontend suite fast, and both have to stay
in place:

1. **`fileParallelism` in `frontend/vite.config.ts`.** Vitest runs test
   files across a pool of workers. This was previously switched off under
   CI (`fileParallelism: !process.env.CI`), which put all ~240 files on a
   single worker. Re-enabling it took a local run from 392s to 240s with an
   identical 2405-test result.
2. **`--shard` in the CI matrix.** Vitest splits the *files* across shards,
   so shard 1 and shard 2 are disjoint and cover the whole suite between
   them. Nothing is skipped and nothing runs twice.

The shard count lives in two places that must agree: the `matrix.shard`
list and the `--shard=N/<count>` argument. Adding a third shard means
updating both.

Sharding by file also means a shard's runtime depends on which files land
in it, so the two shards are not exactly equal (measured 108s and 136s).
That is expected; balance it by splitting an oversized test file, not by
hand-assigning files to shards.

### Where the frontend time actually goes

The suite is heavily concentrated: the five slowest files are ~39% of the
total runtime, and the twenty slowest are ~69%. They are the
integration-style tests that render a real form or page
(`PublicCropLibraryPage`, `CropForm*`, `App`, `FieldsBedsHierarchy.*`)
rather than anything accidentally slow — there are no real sleeps, no
skipped tests and no snapshot tests to reclaim.

The practical consequence: making the suite faster means either more
parallelism or narrowing what those specific files mount, not deleting
tests elsewhere.

## Backend: one job, parallel workers

`backend/pytest.ini` runs the suite with `-n auto --dist loadfile`
(pytest-xdist), which took a local run from 701s to 233s with the same
1164 passing tests and the same combined coverage. `settings_test` uses an
in-memory SQLite database and pytest-django gives each worker its own, so
the workers do not share state.

`--dist loadfile` (rather than the default `load`) is required, not a
preference: it keeps every test in a file on the same worker. The
migration tests migrate the schema backwards to a specific node and
forwards again around each test, so two of them interleaving on one
database would fight over the schema.

Pass `-n0` to run serially again — that is what `--pdb` and any debugging
that needs readable, non-interleaved output want.

### The migration tests are the expensive ones

`farm/tests/test_migrations_*.py` and
`crops/tests/test_migrations_translations.py` are 41 tests — 3.5% of the
suite — and took 261s of the 701s serial run, about 37%. Each test's
`setup_method` replays the migration graph down to `migrate_from` and back
up to `migrate_to`, and `teardown_method` migrates forward to the leaf
again, so a class with four test methods pays for four full cycles.

xdist absorbs most of that cost by spreading the files across workers. If
they become the bottleneck again, the fix is to make the setup class-scoped
so a class pays for one cycle instead of one per test — which requires
checking that the tests in each class do not depend on a freshly migrated
database.

## Why `quality` does not run the backend suite

`scripts/quality.sh` produces lint, complexity and coverage reports, and
running it locally still does all three. In CI the `quality` job sets
`SKIP_BACKEND_TESTS=1`, because `backend-tests` already runs the identical
pytest + coverage command: with it enabled in both, the backend suite ran
twice per pipeline and `quality` took as long as the job it duplicated.

If you add a backend gate, put it in `backend-tests` if it needs the test
run, and in `quality.sh` if it only needs the source.

## E2E: sharded across runners, serial inside one

`frontend/playwright.config.ts` still pins `workers: 1` and
`fullyParallel: false`, and that stays: inside a single runner the specs
share one Django backend on one SQLite file, and concurrent workers there
would contend on that database (the WAL/`transaction_mode` comment in
`config/settings.py` is the scar tissue from exactly that).

Sharding across runners is a different axis and needs none of that. Each
matrix job is a fresh VM, and `playwright.config.ts` starts the backend
itself through its `webServer` block — so each shard gets its own Django
process, its own `db.sqlite3` and its own fixture users for free. Nothing
is shared to contend over.

The suite is additionally scenario-scoped: every spec passes a
`scenario_id` to the `/api/__e2e__/` fixture endpoint, and
`E2EInvitationFixtureView._reset` deletes only that scenario's project,
memberships, invitations and users. No spec depends on another spec having
run, which is why splitting them at any file boundary is safe.

Verify a shard-count change with `npx playwright test --list --shard=N/<count>`
— it needs no browser and no backend, and the shards must add up to the
unsharded total (currently 88 tests in 28 files, split 47 and 41).

Measured on the split's first run: shard 1 spends 4m45s in the test step
and shard 2 3m32s, against 7m10s-7m51s unsharded. Playwright shards by
test count rather than runtime, so the balance is approximate — and note
which way it falls: shard 2 owns both screenshot specs
(`landing-screenshots`, `responsive-layouts`) and is still the *faster*
one. The slow half is shard 1's login-heavy flows (`invitation-flow`,
`fields-beds-*`, `gantt-*`).

### `npm ci` is wildly variable, and it is the biggest remaining cost

`npm ci` takes anywhere from ~18 seconds to ~5 minutes. This is **runner
variance, not a property of any one workflow**: the clearest evidence is a
single e2e matrix run where the two shards — same commit, same workflow,
same lockfile, same restored `cache: npm` — took 18s and 5m03s
respectively. Sampling one job at a time makes it look like `e2e` and
`frontend-build` are "slow" and `frontend-tests` is "fast"; they are not,
they just drew different runners.

On a bad draw `npm ci` is the single largest step in the job, larger than
the tests it sets up, and sharding multiplies it across runners rather
than removing it.

It is *not* Playwright downloading browsers: the post-run step reports
`Path(s) specified in the action for caching do(es) not exist` for
`~/.cache/ms-playwright`, so nothing is ever written there. That also
means the `Cache Playwright browsers` steps in `e2e.yml` and
`frontend-build.yml` never save or restore anything — the Chrome the
config pins comes from the runner image, which is the fast path
`scripts/ci/install-playwright-chrome.sh` documents.

Since `cache: npm` only restores the *download* cache (`~/.npm`) and the
slow runs still have to link ~1000 packages into `node_modules`, the
promising fix is caching `node_modules` itself, keyed on the lockfile
hash. That is untested — measure before and after, over several runs, or
runner variance will make any single comparison meaningless.

## Adding tests

- Keep new frontend files under `src/**/*.{test,spec}.{ts,tsx}` — that is
  what both the shard split and the coverage config match on.
- Prefer extending an existing test file, but not past the point where it
  dominates a shard. A file that is minutes long is a scheduling problem
  for the shard it lands in, since a file never splits across shards.
- Backend tests that manipulate migrations belong in a `test_migrations_*`
  file, so `--dist loadfile` keeps them isolated on one worker.
