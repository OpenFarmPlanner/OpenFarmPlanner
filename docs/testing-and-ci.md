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
| `frontend-tests` | `vitest run` | ~5 min |
| `backend-tests` | `pytest` (xdist, with coverage) | ~6.5-7.5 min |
| `quality` | ruff, radon, ESLint, madge | ~3 min |

`.github/workflows/e2e.yml` runs the Playwright suite against a production
build on pull requests, split across three shards of its own.

All jobs run concurrently, so the pipeline is as long as its slowest job.

## Frontend: one job, parallel within it

What makes this suite fast is **`fileParallelism` in
`frontend/vite.config.ts`**. Vitest runs test files across a pool of
workers; this was previously switched off under CI
(`fileParallelism: !process.env.CI`), which put all ~240 files on a single
worker. Re-enabling it took a local run from 392s to 240s with an
identical 2405-test result.

It is deliberately **not** sharded across runners. It was, briefly, and
the measurement is the reason it is not any more: the two shards' test
steps were 2m10s and 2m41s, i.e. 4m51s of work split onto two runners —
but `backend-tests` in the same workflow runs 6-7.5 minutes, so the second
runner shortened a job that was never the critical path. Merged back the
job is ~5 minutes and still finishes first.

Sharding is close to free to reintroduce if that changes: add a
`strategy.matrix.shard` and a matching `--shard=N/<count>` (the two must
be kept in step), and verify with `npx vitest run --shard=N/<count>` that
the parts add up to the whole. Do that when the suite approaches the
backend job's runtime — currently about two minutes of headroom.

Note the shape of the trade: because each shard already saturates the
runner's cores, splitting is close to *additive* rather than free (locally
104s + 136s against 240s unsharded). Sharding buys wall-clock only when
the job is the one holding the pipeline up.

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
unsharded total: 88 tests in 28 files, currently split 33 / 26 / 29.

Playwright shards by test count, not runtime, and for this suite that
balances badly. Measured test-step times:

| shards | per shard | critical path |
| --- | --- | --- |
| 1 (none) | 7m10s-7m51s | ~7m30s |
| 2 | 4m45s / 3m32s | 4m45s |
| 3 | **4m11s** / 2m17s / 2m14s | **4m11s** |

The third shard bought 34 seconds for a whole extra runner, because the
expensive specs cluster: shard 1 holds the login-heavy `fields-beds-*`,
`gantt-*` and `invitation-flow` files and runs 1.8x as long as either of
the others. Note also which way this falls — the shard holding both
screenshot specs (`landing-screenshots`, `responsive-layouts`) is among
the *fast* ones.

Adding shards is therefore close to exhausted as a lever: a fourth would
split one of the already-fast shards and leave shard 1's 4m11s standing.
What is left is making the tests themselves cheaper.

**Measure the test step, not the job.** Job wall time is dominated by
`npm ci` variance (below); two consecutive runs of the same two shards
came out 10m27s/4m57s and then 7m27s/9m21s — a complete reversal — while
the test steps stayed at 4m45s and 3m32s. Tuning the balance against job
duration optimises noise.

### Where an e2e job's time actually goes

One shard, measured end to end:

| step | before | with a warm cache |
| --- | --- | --- |
| setup (checkout, node, python, uv) | 12s | 10s |
| `npm ci` / node_modules restore | 1m49s | **5s** (install skipped) |
| Chrome check | 9s | 6s |
| `npm run build` | 23s | 20s |
| **tests** (incl. backend boot) | **~5m** | **3m40s** |

Everything outside the tests now adds up to well under a minute, so the
job is ~85% test execution — which is where the remaining work is.

The tests are the majority, and inside them the per-test cost is roughly
4-8 seconds of which a UI sign-in is a large part — the log shows an
`Unauthorized: /api/auth/me/` followed by a login before almost every
test. Shard 1 spends 4m11s on 33 tests, i.e. 7.6s each.

Reusing an authenticated `storageState` across the specs in a scenario,
instead of signing in per test, is the next real lever — and, given the
table above, the only one left that shrinks the suite rather than
redistributing it. It is a refactor of `e2e/utils.ts` and every spec that
calls it, so it needs its own change and its own before/after
measurement.

A second, cheaper thing to try first: raising `workers` above 1 *within* a
shard. Each shard now has its own backend and its own SQLite file, and the
WAL + `transaction_mode=IMMEDIATE` settings that `config/settings.py`
documents were added specifically to survive concurrent e2e load. Whether
that is enough for two workers on one database is untested — try it on a
branch and watch for `database is locked`.

### `npm ci` variance, and why node_modules is cached

`npm ci` takes anywhere from ~18 seconds to ~5 minutes. This is **runner
variance, not a property of any one workflow**: the clearest evidence is a
single e2e matrix run where two shards — same commit, same workflow, same
lockfile, same restored `cache: npm` — took 18s and 5m03s respectively.
Sampling one job at a time makes it look like some workflows are "slow"
and others "fast"; they are not, they drew different runners.

`cache: npm` only restores the *download* cache (`~/.npm`); the slow runs
still link ~840 packages into `node_modules`. So `e2e.yml`,
`frontend-build.yml` and `ci.yml`'s frontend job additionally cache
`frontend/node_modules` itself and skip the install on a hit. The key
pins the lockfile hash and the resolved Node version, so a dependency
bump or a Node major misses and reinstalls instead of reusing an
incompatible tree. Nothing is lost by skipping the install: npm reports
core-js's postinstall as *not* run under this project's allow-scripts
policy, so no install script has a side effect to preserve.

Measured on the run right after the cache was populated: the restore takes
**5 seconds** and the install step is skipped outright, against `npm ci`
runs of 1m49s to 5m03s on the same branch. The e2e shard-1 job went from
7m55s to 4m24s on that change alone, and `frontend-build` from ~2-4
minutes to 43 seconds.

Expect no gain on the *first* run of a branch — Actions caches are scoped
to the branch and its base, so a new branch always misses and populates.
Judge the effect from the second run onward.

There used to be a `Cache Playwright browsers` step in the two Playwright
workflows. It was dead: the log shows `Cache not found for input keys` on
restore and `Path(s) specified in the action for caching do(es) not exist`
on save, because `~/.cache/ms-playwright` is never written — the Chrome
the config pins comes from the runner image, which is the fast path
`scripts/ci/install-playwright-chrome.sh` documents. Both steps are gone.

## Adding tests

- Keep new frontend files under `src/**/*.{test,spec}.{ts,tsx}` — that is
  what the `include` glob and the coverage config match on.
- Watch the frontend job's runtime against the backend job's. It is a
  single job with about two minutes of headroom; past that, re-shard it
  (see above) rather than letting it become the critical path.
- Prefer extending an existing test file, but not past the point where it
  dominates a run. A file that is minutes long is a scheduling problem for
  whichever worker or e2e shard it lands on, since a file never splits.
- Backend tests that manipulate migrations belong in a `test_migrations_*`
  file, so `--dist loadfile` keeps them isolated on one worker.
