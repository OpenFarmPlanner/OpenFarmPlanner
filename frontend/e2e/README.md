# Frontend E2E Tests

Playwright end-to-end tests for OpenFarmPlanner frontend flows.

## Run

```bash
cd frontend
npm run test:e2e
```

## Notes

- The Playwright configuration starts the backend and frontend web servers automatically.
- The frontend server is the **production build** served via `vite preview`, not the Vite
  dev server: `npm run test:e2e` runs `npm run build` first, and Playwright's `webServer`
  entry only runs `vite preview` against the resulting `dist/`. This is intentional — it
  catches production-only bugs (e.g. effect-ordering/timing issues that only show up once
  code is bundled) that the dev server can mask. If you change frontend source and re-run
  `npx playwright test` directly (skipping `npm run test:e2e`), remember to `npm run build`
  first, or your changes won't be reflected.
- A debug-only backend fixture endpoint is available only when:
  - `DEBUG=True`
  - `E2E_TEST_TOKEN` is set for the backend process started by Playwright
- `FRONTEND_PORT` and `BACKEND_PORT` env vars override the default ports (4173 / 8000) if
  you need to run E2E tests alongside an already-running dev environment.
- Two Playwright projects exist. `chromium` runs everything except
  `scrollbar-layout.spec.ts`; `chromium-scrollbars` runs only that spec, with headless
  Chrome's `--hide-scrollbars` flag dropped so the page actually renders a classic
  scrollbar. That spec is about MUI's modal scroll lock compensating the scrollbar
  width, which is unobservable without one. Keep the rest of the suite (and its
  screenshot baselines) on the default, scrollbar-free rendering.

See `frontend/playwright.config.ts` for exact runtime settings. In CI, the
`E2E (production build)` workflow (`.github/workflows/e2e.yml`) runs this same build+test
flow on every pull request targeting `main`.


## Responsive screenshot baseline

Run responsive visual baselines:

```bash
cd frontend
npx playwright test e2e/responsive-layouts.spec.ts
```

Update screenshots intentionally:

```bash
cd frontend
npx playwright test e2e/responsive-layouts.spec.ts --update-snapshots
```

Notes:
- Viewports covered: `375x800`, `768x900`, `1024x900`, `1440x900`.
- Route coverage: dashboard, standorte, anbauflaechen, kulturen, anbauplaene, anbaukalender, ertragsuebersicht, saatgutbedarf, lieferanten.
- Helpers are in `e2e/utils.ts` for deterministic login, viewport presets, and stable-page waiting.

## Landing-page product screenshots

The public landing page uses generated screenshots from a deterministic demo
project. The demo data is created by backend code in
`farm.services.demo_project` and can be reset locally:

```bash
cd backend
pdm run python manage.py seed_demo_project
```

Regenerate the WebP screenshots used by the landing page:

```bash
cd frontend
npm run build
GENERATE_LANDING_SCREENSHOTS=1 npx playwright test e2e/landing-screenshots.spec.ts
```

Notes:
- The viewport is fixed at `1440x900`.
- The assets are written to `public/landing/screenshots/` and currently cover
  areas, crops, calendar, yield overview, and seed demand.
- ImageMagick's `magick` command is required for WebP conversion. Set
  `MAGICK_BINARY=/path/to/magick` if it is not on `PATH`.
- The spec is skipped during normal `npm run test:e2e` runs unless
  `GENERATE_LANDING_SCREENSHOTS=1` is set.
