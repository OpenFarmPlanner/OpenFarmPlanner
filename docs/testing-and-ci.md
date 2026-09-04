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
| `frontend-tests (shard 1/2)` | `vitest run --shard=1/2` | ~3 min |
| `frontend-tests (shard 2/2)` | `vitest run --shard=2/2` | ~3 min |
| `backend-tests` | `pytest` (xdist, with coverage) | ~4 min |
| `quality` | ruff, radon, ESLint, madge | ~1 min |

`.github/workflows/e2e.yml` runs the Playwright suite against a production
build on pull requests, and is the longest job in the pipeline (~12 min).
It is deliberately not sharded — see "Why E2E is not parallel" below.

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

## Why E2E is not parallel

`frontend/playwright.config.ts` pins `workers: 1` and
`fullyParallel: false`. The specs share one Django backend on one database
and log in as the same fixture users, so running them concurrently would
have them overwrite each other's rows. Sharding the E2E suite would mean
giving each shard its own backend and database, which is a larger change
than the frontend shard split.

## Adding tests

- Keep new frontend files under `src/**/*.{test,spec}.{ts,tsx}` — that is
  what both the shard split and the coverage config match on.
- Prefer extending an existing test file, but not past the point where it
  dominates a shard. A file that is minutes long is a scheduling problem
  for the shard it lands in, since a file never splits across shards.
- Backend tests that manipulate migrations belong in a `test_migrations_*`
  file, so `--dist loadfile` keeps them isolated on one worker.
