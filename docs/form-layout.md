# Form Layout

OpenFarmPlanner uses responsive field-width roles from
`frontend/src/components/forms/formLayout.ts`. Form fields are full width on
small screens and receive a stable maximum width from the `sm` breakpoint.
This keeps desktop forms compact without introducing separate mobile forms.

## Width roles

| Role | Typical content | Desktop maximum |
|---|---|---:|
| `compactFieldSx` | numbers, dates, versions, priorities | 180 px |
| `smallFieldSx` | short selects, status, units, methods | 224 px |
| `mediumFieldSx` | families, suppliers, coordinates | 300 px |
| `wideFieldSx` | names, email addresses, URLs | 400 px |
| `fullWidthFieldSx` | descriptions, notes, comments | full row |

Use `formRowSx` to place related compact fields beside each other. It wraps
automatically and aligns fields at the top so validation and helper text do
not disturb neighboring controls.

### Stacked variants

`compactFieldSx` … `wideFieldSx` set a `flex` shorthand, which sizes the
*main axis*. Inside a column `Stack` that axis is the height, so a multiline
field would be stretched vertically instead of constrained horizontally. For
fields stacked vertically rather than laid out in a `formRowSx` row, use the
plain width/maxWidth variants instead:

| Role | Equivalent of |
|---|---|
| `mediumStackedFieldSx` | `mediumFieldSx` (300 px) |
| `wideSingleColumnFieldSx` | `wideFieldSx` (400 px) |
| `wideStackedFieldSx` | wide multiline fields (460 px) |

Authentication and similar identity forms are capped by their page shell
(`AuthPageShell` plus `pages/auth/authPageStyles.ts`), not by a form-layout
role.

## Exceptions

DataGrid cell editors must fill their cell and therefore do not use these
roles. A field may also remain full width inside an already narrow popover or
small dialog, and search fields may grow when the remaining horizontal space
is intentionally assigned to search.
