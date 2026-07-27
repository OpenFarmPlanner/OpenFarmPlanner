# Demo Project Template

OpenFarmPlanner defines its reusable demo project data in
`backend/farm/services/demo_project.py`.

The service has two persistent-data entry points:

- `create_personal_demo_project(user=...)` creates one normal, editable
  project for the authenticated user and is used by first-project onboarding
  and the project switcher's explicit "load demo project" action.
- `create_or_reset_demo_project(...)` recreates the local screenshot/demo
  fixture used by the management command and landing-page screenshot workflow.

The template currently creates the `Solawi Sonnenacker` project with two
locations, four fields, twelve beds, three suppliers, eight vegetable cultures,
seed package data, and twelve planting plans for the 2026 season. All created
records are project-scoped and owned by the receiving user through a regular
admin `ProjectMembership`.

The public landing page also starts an isolated anonymous guest project from this template. Guest workspaces are editable but session-bound, reset on the next browser session, and removed after their short server-side retention period by `cleanup_guest_demo_sessions`. This is separate from the persistent personal demo project.

The frontend opens the first-project onboarding automatically only while the
authenticated user's project membership list is empty. Loading the demo project
from the project switcher remains a separate action.
The onboarding screen itself stays focused on starting a project. Deleted
projects are restored or permanently deleted through the project switcher's
trash entry, which opens the existing project trash view.

To adjust the template, update the specs in `demo_project.py` and extend the
focused backend tests in `backend/farm/tests/test_demo_project.py`. The project
API behavior is covered in `backend/farm/tests/test_projects_api.py`; the
frontend onboarding choice is covered in
`frontend/src/__tests__/ProjectSelectionPage.test.tsx` and
`frontend/e2e/onboarding-demo-project.spec.ts`.

Landing-page screenshots are generated from this same template and currently
cover areas, crops, calendar planning, yield overview, and seed demand.

Local checks:

```bash
cd backend
pdm run test farm/tests/test_demo_project.py farm/tests/test_projects_api.py

cd ../frontend
npx vitest run src/__tests__/ProjectSelectionPage.test.tsx
npx playwright test e2e/onboarding-demo-project.spec.ts
```

For the standalone local demo user/project used outside onboarding:

```bash
cd backend
pdm run python manage.py seed_demo_project
```
