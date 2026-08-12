# QA Coverage — 2026-06-30

Letzte vollständige Regression: **2026-06-30**
Git-Stand: `3d2f3351` (HEAD), Branch `codex/refine-fields-empty-state`
Commits seit vorherigem vollen QA-Sweep (2026-06-29): 15

---

## Getestete Bereiche & Status

| Bereich | Getestet | Ergebnis | Anmerkungen |
|---------|----------|----------|-------------|
| Kulturen – Liste (DataGrid) | ✅ | ok | Sortierung, Suche, Inline-Edit |
| Kulturen – Detail-Panel | ✅ | ok | Tabs, Felder, Notizen |
| Kulturen – Erstellen | ✅ | ok | Dialog, Validierung, Duplikat-Prüfung |
| Kulturen – Löschen | ✅ | ok | Bestätigungsdialog → Undo-Snackbar (10s) |
| Kulturen – Versionsverlauf | ✅ | ok | Empty-State, Restore-Button, Feedback |
| Kulturbibliothek | ✅ | ok | Öffnet, Suche, Import, bleibt offen nach Import |
| Kulturen – Import/Export | ✅ | ok | CSV-Export funktioniert |
| Anbaupläne – DataGrid | ✅ | ok | Erstellen, Bearbeiten per Inline-Edit, Enter-to-Save |
| Anbaupläne – Löschen | ✅ | ok | Delete-Taste → Undo-Snackbar |
| Anbaupläne – Empty State | ✅ | ok | Voraussetzungen werden angezeigt |
| Anbaukalender | ✅ | ok | Navigation, Ansichten (Tag/Woche/Monat/Quartal/Jahr), Pläne sichtbar |
| Anbauflächen (Standorte) | ✅ | ok | Liste, Erstellen via Dialog |
| Anbauflächen (Grafik-Editor) | ✅ | ok | Auto-Save (250ms), kein expliziter Speichern-Button |
| Felder & Beete – DataGrid | ✅ | ok | Inline-Edit, Kontextmenü, Löschen |
| Saatgutbedarf | ✅ | ok | Benötigt seed_rate_value/direct/pre_cultivation (nicht seed_quantity_per_sqm) |
| Lieferanten – Liste | ✅ | ok | Erstellen, Bearbeiten, Löschen via Hover-Buttons |
| Ertragsübersicht | ⚠️ | nur leer | Nur leeren Zustand gesehen; mit Daten nicht voll getestet |
| Projekteinstellungen | ✅ | ok | Umbenennen (via Stift-Icon), Mitglied einladen, Mitgliederliste |
| Kontoeinstellungen | ✅ | ok | Anzeigename ändern (via Edit-Button + Collapse) |
| Command Palette (Alt+K) | ✅ | ok | Öffnen, Suche, Escape |
| Tastaturnavigation | ✅ | ok | Tab/Shift+Tab, Enter, Escape, Pfeiltasten |
| Mobile Viewport | ✅ | ok | Hamburger-Menü, Layout ohne horizontalen Overflow |
| Seitenhilfe | ✅ | ok | Popover (Desktop) / Dialog (Mobile) |
| Sidebar collapse/expand | ✅ | ok | Fokus wird korrekt übertragen |
| Registrierung / Login / Logout | ✅ | ok | Vollständiger Fluss |
| Invite-Flow | ⚠️ | teilweise | URL zugänglich, Redirect zu Login — Annahme durch Eingeladenen nicht voll getestet |
| Browser Zurück/Vorwärts/Reload | ✅ | ok | Kein Datenverlust |
| XSS / Sonderzeichen | ✅ | ok | Korrekt sanitized |

---

## Bekannte Playwright-Headless-Artefakte (keine echten Bugs)

Diese Fehler treten nur in headless Playwright auf, nicht im echten Browser:

- `useResizeContainer` Warning auf `/app/fields-beds` und `/app/planting-plans` — tritt auf wenn DataGrid in einem 0px-breiten Container montiert wird (headless-only)
- CSS-`hover`-Buttons (Lieferanten, Standorte) nicht per `page.hover()` in headless zuverlässig triggerable — im echten Browser funktioniert Hover korrekt

---

## Wichtige UI-Patterns (Fallstricke für Tests)

| Pattern | Details |
|---------|---------|
| Account-Settings Felder | Erst per "Bearbeiten"-Button öffnen — dann erscheint `<input>` per `<Collapse>` |
| Projektname bearbeiten | Stift-Icon neben Namen anklicken → erst dann `<TextField>` sichtbar |
| Seitenhilfe | `getByRole('dialog')` findet es nicht auf Desktop — ist ein `Popover` |
| Kulturbibliothek nach Import | Dialog bleibt offen — by design (Mehrfachimport möglich) |
| Grafik-Editor | Kein Save/Discard-Button — 250ms Auto-Save nach Drag |
| Delete → Undo | Löschen zeigt Undo-Snackbar (10s), KEIN zweites Bestätigungsdialog |
| Kulturen-Delete | Ausnahme: Kulturen bekommen ERST Bestätigungsdialog, DANN Undo-Snackbar |
| Saatgutbedarf Felder | `seed_rate_value`, `seed_rate_direct_value`, `seed_rate_pre_cultivation_value` (NICHT `seed_quantity_per_sqm`) |
| Anbaukalender Route | `/app/gantt-chart` (NICHT `/app/calendar`) |
| E2E-Setup API Response | `res.admin.email` / `res.admin.password` (NICHT `res.email` / `res.token`) |

---

## Gefixte Bugs in dieser Session (2026-06-29 – 2026-06-30)

| ID | Commit | Beschreibung |
|----|--------|-------------|
| EXP-01 | `2255a224` | Export-Dateiname nutzte Lieferanten- statt Kulturname |
| DG-01 | `da14a7ea` | DataGrid `useResizeContainer` Warning — fehlende aria-labels |
| DG-02 | `2255a224` | DataGrid Warning auf Anbaupläne via conditional render gefixt |
| HIST-01 | `9b38a143` | Culture version restore: kein Error-Handling, kein Success-Feedback |
| HIST-02 | `dcb4ba07` | Versionsverlauf-Dialog-Titel zeigte "öffnen" statt "Versionsverlauf" |
| HTML-01 | `04248188` | `<p>` enthielt `<div>` in EmptyStateCard.tsx |
| HTML-02 | `04248188` | `<p>` enthielt `<div>` in App.tsx (Version-Dialog) |
| MOB-01 | `04248188` | Mobile DataGrid off-screen render in PlantingPlans |
| SC-01 | `04248188` | Falsches Shortcut-Label "Ctrl+K" statt "Alt+K" in Kulturen |
| ARIA-01 | `3165adbd` | Beide View-Toggle-Buttons hatten identischen aria-Label |
| FOCUS-01 | `dcb4ba07` | Sidebar collapse/expand verlor Keyboard-Fokus |
| CMD-01 | `e4d071d4` | PlantingPlans Delete-Command hatte falsches Shortcut-Label |

---

## Empfehlung: Nächster voller Re-Sweep

Wenn sich eines der folgenden Kriterien erfüllt:
- ≥ 20 Commits seit `3d2f3351`
- Änderungen an Querschnittskomponenten (App.tsx, DataGrid, Topbar, Sidebar)
- Vor einem Release oder größerem Feature-Merge
