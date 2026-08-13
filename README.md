# OpenFarmPlanner

🌐 **Website:** https://openfarmplanner.org

OpenFarmPlanner is an open-source crop planning tool for vegetable production. It helps market gardens and community-supported agriculture (CSA) plan crops, growing areas, and planting schedules in one place.

Built with a Django REST Framework backend and a React frontend in a single repository.

> Deployment and infrastructure are maintained in a separate repository: **[OpenFarmPlanner-ops](https://github.com/stipsitzm/OpenFarmPlanner-ops)**.

## Main Features

- Farm structure management (locations, fields, beds)
- Culture management with agronomic details and history/restore support
- Planting plans, task planning, and Gantt/yield-oriented views
- Seed demand and supplier workflows
- Multi-project support with project switching and invitations
- Session-based authentication (registration, activation, login/logout, password reset, account deletion/restore), optionally with Google/Microsoft sign-in
- Notes and media attachments

## High-Level Architecture

- **Backend (`backend/`)**: Django + Django REST Framework API, authentication, business logic, data persistence, media handling.
- **Frontend (`frontend/`)**: React + TypeScript SPA (Vite), UI workflows, routing, i18n resources, and API integration.
- **Operations (`OpenFarmPlanner-ops`)**: deployment, runtime environment, and operational automation (separate repository).

## Repository Structure

```text
.
├── backend/                  # Django backend application
├── frontend/                 # React frontend application
│   └── e2e/                  # Playwright end-to-end tests
├── docs/                     # Additional design/technical notes
├── scripts/                  # Shared utility and quality scripts
├── CONTRIBUTING.md           # Commit and contribution conventions
└── README.md                 # Canonical repository entry point
```

## Tech Stack

**Backend**
- Python 3.12+
- Django 5.2
- Django REST Framework
- PDM for dependency and script management
- SQLite by default (PostgreSQL supported via env configuration)

**Frontend**
- React 19 + TypeScript
- Vite
- Material UI
- React Router
- Axios
- Vitest + Testing Library
- Playwright (E2E)

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- [PDM](https://pdm-project.org/)
- Node.js 20+
- npm 10+

## AI Agent Setup

Copilot and Codex agents work best when the local development environment includes the same tooling they use for repo inspection, pull request management, and CI log review.

### Required tooling

- `git`
- GitHub CLI (`gh`)
- Python 3.12+ with PDM
- Node.js 20+ with npm 10+

### GitHub CLI setup

This repository is not currently set up with a committed Dockerfile or DevContainer configuration, so `gh` must be installed on the host machine.

On Ubuntu or Debian:

```bash
sudo apt update
sudo apt install gh
```

If your distribution packages an older version, install `gh` using the method recommended by GitHub for your platform.

Verify the installation:

```bash
which gh
gh --version
```

### Authentication

Authenticate GitHub CLI before using agent workflows that inspect pull requests, workflow runs, or logs:

```bash
gh auth login
gh auth status
```

### What agents use `gh` for

- Inspecting pull requests and reviews
- Checking GitHub Actions workflow runs and logs
- Creating or updating PRs from automation
- Reproducing CI failures locally with the same GitHub identity

### 1) Backend setup

```bash
cd backend
cp .env.example .env
pdm install
pdm run migrate
pdm run runserver
```

Backend API base path: `http://localhost:8000/api/`

### 2) Frontend setup

In a new terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend dev server: `http://localhost:5173/`

### Local LAN testing

To test the development app from a phone or tablet in the same network, start both servers with:

```bash
scripts/dev-lan.sh
```

The script detects the local LAN IP, starts Django on `0.0.0.0:8000`, starts Vite on `0.0.0.0:5173`, and prints URLs such as:

- Frontend: `http://<LAN-IP>:5173`
- Backend: `http://<LAN-IP>:8000`

Keep `VITE_API_BASE_URL` unset for normal development so browser requests use `/api` and Vite proxies them to the backend. If you do set `VITE_API_BASE_URL` to `http://localhost:8000/api`, the frontend rewrites that development-only localhost URL to the current LAN host when opened from another device.

## Backend / Frontend Overview

- The frontend sends credentialed requests to `/api/` and includes CSRF headers for write operations.
- The backend enforces authenticated access for API endpoints by default and supports project scoping via `X-Project-Id`.
- Public flows (registration, activation, login, password reset, invitation acceptance) are exposed through dedicated auth/invitation endpoints.

## Authentication Overview

OpenFarmPlanner uses Django session authentication with CSRF protection:

- Register account
- Activate account by email link
- Login / logout
- Login with Google or Microsoft (optional, see [`docs/social-login.md`](docs/social-login.md))
- Password reset request and confirmation
- Account deletion request with grace period and restoration flow

Authentication endpoints are available under:

- `/api/auth/*`

## Testing Overview

### Backend

```bash
cd backend
pdm run test
```

### Frontend unit/integration tests

```bash
cd frontend
npm run test
```

### Frontend end-to-end tests

```bash
cd frontend
npm run test:e2e
```

`npm run test:e2e` builds the production frontend bundle (`npm run build`) and runs
Playwright against that build via `vite preview`, not the Vite dev server — this catches
production-only bugs (e.g. behavior that only appears once code is bundled) that dev mode
can hide. The `E2E (production build)` GitHub Actions workflow (`.github/workflows/e2e.yml`)
runs the same build-then-test flow on every pull request targeting `main` and must pass
before merging; it can be added as a required status check in branch protection.

## Version Bumping

Project version is defined in `backend/config/version.py` as a semantic version (`MAJOR.MINOR.PATCH`).

Use the provided script via Make:

```bash
make bump-version TYPE=fix
```

Supported change types:

- `TYPE=feat` → bumps **minor** (`x.Y.z`) and resets patch to `0`
- `TYPE=fix` → bumps **patch** (`x.y.Z`)
- `TYPE=breaking` → bumps **major** (`X.y.z`) and resets minor/patch to `0`

The update is validated and applied safely:

- exactly one `VERSION = "..."` definition must exist,
- version format must be valid semver,
- file writes are done via atomic replace.

## Automatic Release Labels (Pull Requests)

This repository uses a GitHub Action (`.github/workflows/auto-release-label.yml`) to auto-assign one release label on pull requests:

- `release:major`
- `release:minor`
- `release:patch`

Trigger events:

- `pull_request` with types: `opened`, `edited`, `synchronize`

Decision rules:

- `release:major` if PR content includes `BREAKING CHANGE` or `breaking`
- `release:minor` for feature keywords: `add`, `feature`, `implement`, `new`
- `release:patch` for maintenance keywords: `fix`, `bug`, `refactor`, `docs`, `localize`, `translation`, `ui`
- fallback defaults to `release:patch` if no keyword matches

Safety behavior:

- if any release label is already present, the workflow logs and skips reassignment,
- if none exists, it ensures labels exist at repository level, removes any release labels from the PR (defensive cleanup), and assigns exactly one.

## Documentation Map

- `backend/README.md` – backend-specific development details
- `frontend/README.md` – frontend-specific development details
- `frontend/e2e/README.md` – E2E testing notes
- `CONTRIBUTING.md` – commit conventions and contribution expectations
- `CHANGELOG.md` – released versions and their user-visible changes
- `CLAUDE.md` – rules AI coding agents must follow in this repository (`AGENTS.md` is a stub pointing here)
- **[`docs/index.md`](docs/index.md)** – technical documentation index: architecture overview, data model, and deep dives into complex features (DataGrid, keyboard navigation, Gantt/occupancy hierarchy, Crop Library, seed demand calculation, versioning/history)
- [`docs/archive/`](docs/archive/) – historical implementation notes and point-in-time reports, kept for their original reasoning; **not maintained**, see `docs/index.md` for the current documentation
- [`docs/qa-archive/`](docs/qa-archive/) – dated QA reports, fix logs, and superseded coverage snapshots; the current QA documents stay in `docs/`

## Deployment / Operations

Deployment and runtime operations are intentionally separated from this repository.
Use the ops repository for deployment guides, infrastructure configuration, and environment-specific operational steps:

- **https://github.com/stipsitzm/OpenFarmPlanner-ops**

## Contributing

Pull requests are welcome.

For larger changes, please open an issue first to align on scope and approach.
Keep contributions focused, incremental, and consistent with the existing project structure and style.

See `CONTRIBUTING.md` for commit format requirements.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

### Third-party code

`frontend/src/gantt-chart/` is vendored from [react-modern-gantt](https://github.com/MikaStiebitz/React-Modern-Gantt) by Mika Stiebitz, MIT License. The original license text and copyright notice are preserved at [frontend/src/gantt-chart/LICENSE](frontend/src/gantt-chart/LICENSE); see [frontend/src/gantt-chart/README.md](frontend/src/gantt-chart/README.md) for provenance details.

## Developer Quality Checks

Run the shared quality script before opening a PR:

```bash
./scripts/quality.sh
```

This script executes the backend and frontend lint/test gates used in CI.
