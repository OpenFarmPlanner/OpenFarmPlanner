# Design System: MUI + Tailwind CSS v4

OpenFarmPlanner styles its UI with two systems that have clearly separated
jobs. Getting the split right matters more than either tool on its own.

| Layer | Owner | Use it for |
| --- | --- | --- |
| **MUI theme** (`frontend/src/theme.ts`) | components | anything a MUI component renders: buttons, dialogs, alerts, DataGrid, tooltips, focus rings |
| **MUI `sx`** | component instances | one-off adjustments to a MUI component, and any style that has to reach a MUI slot |
| **Tailwind utilities** | plain DOM | layout and box model on elements *we* render (`div`, `span`, `Box`), and anything that would otherwise become a new `.css` file |

**Do not add a new `.css` file for a component.** That is the pattern this
setup exists to remove. If a utility cannot express it, it almost always
belongs in `theme.ts` (because it is a component-wide decision) or in `sx`
(because it is one instance).

---

## 1. Cascade layers

The layer order is declared once, at the very top of
`frontend/src/index.css`:

```css
@layer theme, base, mui, components, utilities;
```

- MUI emits its Emotion styles into `@layer mui`, enabled by
  `<StyledEngineProvider enableCssLayer>` in `main.tsx`.
- `mui` sits **after** `base`, so `<CssBaseline />` stays in charge of the
  element reset.
- `utilities` sits **after** `mui`, so a Tailwind utility overrides a MUI
  component style without `!important`.

Tailwind's **Preflight is deliberately not imported**. `<CssBaseline />`
already owns the global reset; layering a second, differently-opinionated one
on top would change how every heading, list and link renders. `index.css`
imports only `tailwindcss/theme.css` and `tailwindcss/utilities.css`.

### The one trap to know about

Unlayered CSS outranks *every* layer, including `utilities`. Now that MUI
lives in `@layer mui`, any leftover unlayered stylesheet silently wins over
`sx` — the reverse of how it behaved before, when Emotion's late injection
decided the tie. Two real cases were found and fixed during the migration
(a hover colour and a Gantt `margin-top`).

The only unlayered stylesheet left is `frontend/src/pages/GanttChart.css`,
and it stays unlayered on purpose: it overrides the vendored Gantt library in
`src/gantt-chart/`, whose own `gantt.css` is unlayered too. Layering the
overrides would let the library's defaults win.

---

## 2. Tokens

All tokens live in the `@theme static` block in `frontend/src/index.css`.
They are derived from the existing design — Tailwind's own defaults for
colours, radii and shadows are switched off with `--color-*: initial` and
friends so there is exactly one named token per design decision instead of
250 generic shades.

`static` means every token is emitted as a CSS variable on `:root` whether or
not a utility uses it, so stylesheets Tailwind does not compile (again:
`GanttChart.css`) can reference them.

### Spacing

```
--spacing: 0.5rem   /* 1 unit = 8px = one MUI spacing unit */
```

This is the single most useful thing in the file: **`className="p-2"` and
`sx={{ p: 2 }}` mean the same 16px.** Half steps work in both (`p-0.5` /
`sx={{ p: 0.5 }}` = 4px). Never reach for `p-[10px]`.

### Breakpoints

```
sm 600px · md 900px · lg 1200px · xl 1536px
```

These mirror MUI's defaults, so `max-sm:` and
`theme.breakpoints.down('sm')` describe the same viewport. (`max-sm:` is
`< 600px` where MUI's `down('sm')` is `<= 599.95px` — the same thing for any
real viewport.)

### Colours

| Group | Tokens |
| --- | --- |
| Brand | `brand`, `brand-dark`, `brand-light`, `brand-strong`, `brand-accent` |
| Surfaces | `app`, `page`, `content`, `surface`, `surface-subtle`, `surface-hover`, `surface-border`, `surface-soft-border` |
| Navigation chrome | `nav-from`, `nav-to`, `nav-active`, `tooltip` |
| Semantic | `danger`, `danger-dark`, `danger-surface`, `info`, `info-dark`, `info-surface`, `info-surface-strong`, `warning`, `success` |
| Neutrals | `neutral-50` … `neutral-900` (`neutral-900` is the body text colour) |
| Feature | `gantt-task` |

The brand, surface and semantic values come straight from `theme.ts`, so
`bg-surface-hover` and `sx={{ bgcolor: 'surface.surfaceHoverBackground' }}`
paint the same pixel.

### Radii, shadows, typography

- `rounded-md` is MUI's `shape.borderRadius` (4px); `rounded-lg` is
  `sx={{ borderRadius: 2 }}` (8px).
- `shadow-card` and `shadow-toast` are the two shadows the app actually uses.
- Tailwind's `text-xs` / `text-sm` / `text-base` already line up with MUI's
  `caption` / `body2` / `body1`, so the scale is kept and only `text-tooltip`
  (0.8125rem) and `text-control` (0.95rem) are added.
- `font-sans` is the global stack from `:root`; `font-mui` is MUI's own.

---

## 3. i18n and writing direction

The UI ships German and English today (see [i18n.md](./i18n.md)), both
left-to-right, but the utility choices are made so an RTL locale does not
require a rewrite:

- **Prefer the logical utilities.** `px-*`, `mx-*`, `ps-*`, `pe-*`, `ms-*`,
  `me-*`, `start-*`, `end-*` and `text-start` / `text-end` all follow the
  document direction. Tailwind v4 compiles `px-2` to `padding-inline`, so the
  common cases are direction-safe by default.
- **Use the physical utilities only for physically-defined values.** The page
  gutter in `components/layout/pageContainerStyles.ts` applies
  `env(safe-area-inset-left)` with `pl-*`, not `ps-*`: the inset describes the
  physical left edge of the device, so a logical utility would move it to the
  wrong side in RTL.
- Nothing in the token set encodes a direction, and no class name is
  translated, so switching `dir` stays a layout concern rather than a
  styling one.

---

## 4. What was intentionally left alone

`frontend/src/gantt-chart/` is a vendored copy of a third-party Gantt library,
with its own README, LICENSE and 1160-line stylesheet whose class names are
part of its public API (`getComponentClassName`, `themes.ts`) and are used as
selectors by the e2e specs. Its CSS is not migrated. The app's own overrides
sit in `pages/GanttChart.css` and feed the library's `--rmg-*` variables from
the tokens above.
