# In-App Notifications

A small, deliberately generic system: one model, one self-scoped API, one
topbar bell. It exists because moderation decisions happen asynchronously —
a user proposes a crop species, closes the app, and a moderator decides hours
later. Without a notification, the outcome is only discoverable by chance.

## Why the stored text is English

`Notification.message` holds an **English** sentence, and the app UI never
renders it. This is not an oversight:

- CLAUDE.md requires API responses to stay English, while the UI must be
  German through i18n resources. A German sentence baked into the row would
  violate both halves — an English UI would show German, and the API would
  ship German.
- The language a notification should read in is the language of whoever is
  looking at it *now*, not the language in effect when it was created.

So the row carries `notification_type` plus a `context` dict, and the frontend
builds the sentence from `notifications:messages.<type>` with `context` as the
interpolation values (`frontend/src/notifications/notificationDisplay.ts`).
`message` remains for the Django admin, logs, and any non-UI API consumer, and
doubles as the fallback if an unknown type ever reaches an older client — a
raw enum value must never surface at the user.

Adding a notification kind is therefore a `TYPE_CHOICES` entry plus two
translation keys, no serializer change. Django still generates a migration for
the `choices` metadata change, but it alters no column and is instant to
apply.

## Model

`backend/notifications/models.py`

| Field | Purpose |
|---|---|
| `recipient` | The user the notification belongs to. Cascade-deleted with the account. |
| `notification_type` | Extensible `choices` field; the key the UI translates. |
| `message` | English fallback (admin/API only). |
| `context` | JSON interpolation values, e.g. `{"name": "Kürbis"}`. |
| `target_type` / `target_id` | Loose reference to the affected object. Deliberately not a `GenericForeignKey`: the target may be gone by the time it is read, and a dangling row should degrade to "no link", not to a broken query. |
| `is_read` | Per-notification, set only by an explicit click. |
| `created_at` | Ordering key (newest first). |

Routes are resolved on the frontend, not stored: the backend has no business
knowing what `/app/crop-library?cultureId=…` means.

## API

`/api/notifications/` — list plus mark-read, both strictly scoped to
`request.user`. There is **no create endpoint**; notifications are produced
server-side through `notifications.services.create_notification`.

- `GET /api/notifications/` — paginated, newest first, with `unread_count`
  folded into the same payload. The bell needs both numbers on every app load,
  and one request beats two.
- `POST /api/notifications/<id>/read/` — marks exactly one as read. Someone
  else's id 404s (it is filtered out of the queryset, not merely rejected).

## Producers

All three producers today live in `crops.services`:

- `notify_species_proposal_reviewed(species)`, called from
  `CropSpeciesViewSet.approve()`/`reject()`. Tells the *proposer* the outcome.
  Does nothing for species nobody proposed (seeded/admin rows) or for a status
  that is not a review outcome, so the call sites stay unconditional. Links to
  the proposer's own published variety under that species when one exists —
  that variety is what the decision actually affects — and falls back to the
  species itself otherwise (`target_type` `public_culture` / `crop_species`).
- `notify_moderators_of_species_proposal(species)`, called from
  `CropSpeciesViewSet.create()`. Tells every *public-library moderator*
  (`crops.permissions.public_library_moderator_users()`) that a new proposal
  is waiting.
- `notify_admins_of_moderator_request(moderator_request)`, called from
  `PublicLibraryModeratorRequestViewSet.create()`. Tells every *public-library
  admin* (`crops.permissions.public_library_admin_users()`) — not every
  moderator, since only admins can review these requests.

The latter two both use `target_type = Notification.TARGET_PUBLIC_LIBRARY_MODERATION`,
which the frontend resolves to `/app/public-library-moderation` — the
moderation queue has no per-item detail route, so every notification of this
kind opens the same page.

`create_notification` skips missing and inactive recipients, so producers do
not each re-implement that check.

## Frontend

`frontend/src/notifications/`

- `NotificationBell.tsx` — the **full topbar** only: an icon with an unread
  `Badge` (no badge at zero, which is MUI's default for `badgeContent={0}`)
  and a `Menu` of entries.
- `useNotificationMenuItems.tsx` — the same entries as items of the **compact
  topbar's** "Mehr" (⋮) menu, with the unread `Badge` moved onto that menu's
  own button. The compact topbar has no room for another icon: adding a
  standalone bell collapsed the page title to a single letter at 375px on
  action-heavy pages (Anbauflächen), which is what made the responsive
  screenshot baseline fail. Collapsing a secondary action into that menu is
  the pattern the topbar already uses elsewhere.
  It is a hook returning an array, not a component, because MUI's `Menu` reads
  its direct children for keyboard navigation. `RootLayout` calls it and hands
  the result to `GlobalMenu` as `notificationItems`, so `GlobalMenu` itself
  needs neither router nor data-fetching context — it renders what it is
  given.
- `RootLayout` owns one `useNotifications` controller and feeds both entry
  points, so the list is fetched once regardless of breakpoint.
- `useNotifications.ts` — loads on mount and again on every dropdown open.
  Deliberately **not** polled: these are the outcome of a human moderation
  decision, so a refresh on open is timely enough and costs one request rather
  than one per interval per open tab. Mark-read is applied optimistically so
  the badge reacts immediately.
- `notificationDisplay.ts` — type + context → localized text, and
  target → in-app route.

Two behaviours are load-bearing and easy to "fix" wrongly:

- **Opening the dropdown marks nothing as read.** Only clicking one entry
  does. A bulk "seen" on open would silently bury a decision the user glanced
  past.
- **Relative timestamps use `Intl.RelativeTimeFormat` with
  `numeric: 'always'`** (`frontend/src/utils/relativeTime.ts`), not translated
  strings. Wording, plural rules and word order differ per language and the
  platform already knows them. `'always'` rather than `'auto'` keeps the count
  visible ("vor 2 Tagen" instead of "vorgestern"), which is what a list mixing
  several ages needs; sub-minute ages fall back to `'auto'` so they read
  "jetzt" instead of "vor 0 Sekunden".
