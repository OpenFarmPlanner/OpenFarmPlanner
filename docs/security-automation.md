# Automated security checks

OpenFarmPlanner uses several complementary automated checks. They are kept
separate because each check answers a different security question.

| Check | Trigger | Purpose |
|---|---|---|
| `pip-audit` and `npm audit` | Pull requests, pushes to `main`, weekly, manual | Find known vulnerabilities in the complete locked backend and frontend dependency sets. High and critical npm findings fail the workflow. |
| Dependency Review | Pull requests to `main` | Prevent a pull request from introducing a dependency with a known high or critical vulnerability. |
| CodeQL | Pull requests, pushes to `main`, weekly, manual | Scan Python and JavaScript/TypeScript source for security-relevant data-flow and coding defects. |
| Django deployment checks | The backend CI job | Fail CI when Django reports a deployment security warning for the production-like CI configuration. |
| Dependabot | Weekly | Propose updates for Python, npm, and GitHub Actions dependencies. |

The scheduled dependency and CodeQL scans are intentional: a vulnerability can
be disclosed after an unchanged commit has passed its pull-request checks.

## GitHub repository settings

Workflow files cannot enable repository-level GitHub security features. A
repository administrator should verify that these settings remain enabled:

- Dependabot alerts and Dependabot security updates;
- secret scanning and push protection;
- code scanning alerts; and
- branch protection or rulesets requiring the security checks used by the
  repository.

GitHub secret scanning is the primary automated secret detector. Do not put
real credentials in CI variables used only to validate configuration; the
Django deployment check deliberately uses an obvious, non-production value.

## Scope and review expectations

Routine checks are deterministic guardrails, not a replacement for review.
Authorization boundaries, project scoping, OAuth account linking, token flows,
and business-logic abuse cases require focused human or AI-assisted security
review. Conversely, an ordinary UI-only change normally needs no additional
backend-specific manual security procedure beyond the automated required
checks.
