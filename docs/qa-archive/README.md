# QA Archive

Dated QA snapshots: exploratory test reports (`qa-report-*.md`), the fix logs
that followed them (`qa-fixes-*.md`), and superseded coverage records
(`qa-coverage-*.md`). Each describes the app at one commit and is never
updated afterwards.

The actively maintained QA documents stay in [`docs/`](../):

- [`qa-strategy.md`](../qa-strategy.md) — when to run a full vs. targeted sweep
- the **most recent** `qa-coverage-*.md` — what was last tested, at which commit
- [`qa-excluded-issues.md`](../qa-excluded-issues.md) — known won't-fix items

When a new `qa-coverage-*.md` is written into `docs/`, move the previous one
here and update the reference in [`docs/index.md`](../index.md).
