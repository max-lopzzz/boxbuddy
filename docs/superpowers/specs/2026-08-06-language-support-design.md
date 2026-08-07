# BoxBuddy — Language Support Design

## Overview

BoxBuddy is currently English-only. A Spanish-speaking user opened the app on a phone set to
Spanish and saw an all-English interface. This design adds bilingual (English/Spanish) support:
the app auto-detects the visitor's preferred language from their browser on first visit, and a
new Settings control lets anyone switch languages explicitly at any time.

## Goals

- All static UI text (labels, buttons, empty states, placeholders, field hints) is available in
  both English and Spanish.
- The language is auto-detected from the browser's `Accept-Language` header on a visitor's first
  visit (before they've ever chosen a language explicitly).
- A "Language" control in Settings lets anyone switch between English and Spanish at any time,
  taking effect immediately.
- A signed-in user's chosen language follows them to a new device/browser (not just the one
  where they picked it).
- No new npm dependencies — implemented with the project's existing tools.

## Non-Goals

- Translating server-generated error/validation messages (e.g. "This code is already used by
  another item.", `parseItemInput`'s validation errors). These remain English-only for now — a
  known, explicit limitation.
- Translating the "BoxBuddy" brand name or technical field names like "SKU".
- Any language beyond English/Spanish.
- Locale-prefixed URLs (e.g. `/es/items/new`) — the URL stays the same regardless of language.
- Any change to date/number/currency formatting.

## Architecture

- **Dictionaries**: `lib/i18n/en.ts` and `lib/i18n/es.ts`, each a flat object of the same string
  keys (e.g. `"dashboard.addItem"`) mapping to English/Spanish text respectively. A shared
  `Locale = "en" | "es"` type and a `TranslationKey` type derived from the English dictionary's
  keys, so a translation missing from `es.ts` (or vice versa) is a TypeScript error, not a
  silent runtime gap.
- **Reading the current locale**:
  - Server Components call a `getLocale()` helper (`lib/i18n/server.ts`) that reads a
    `boxbuddy_locale` cookie via `next/headers`'s `cookies()`, defaulting to `"en"` if absent.
  - Client Components use a `useTranslation()` hook (`lib/i18n/client.tsx`) backed by a
    `LocaleProvider` React Context. The root layout (`app/layout.tsx`, a Server Component) reads
    the same cookie and passes the initial locale into `<LocaleProvider>`, which wraps
    `children`.
- **Auto-detection**: `middleware.ts` (already runs on every request for Supabase session
  refresh) gains one more step: if the `boxbuddy_locale` cookie is absent, parse the request's
  `Accept-Language` header — if Spanish (`es`, `es-*`) is the first acceptable language, set the
  cookie to `"es"`; otherwise `"en"`. Once set, the cookie is never overwritten by auto-detection
  again — only an explicit Settings change updates it after that.
- **New dependency**: none.

## Persistence

- Choosing a language in Settings immediately updates the `boxbuddy_locale` cookie (effective
  right away, and works even for the pre-login pages, since it's not tied to an account).
- If the user is signed in, the same action also saves the choice to their Supabase Auth
  `user_metadata` (via `supabase.auth.updateUser({ data: { locale } })`) — no new database table
  or column needed.
- On login, if the signed-in user's account has an explicitly saved preference
  (`user_metadata.locale` is set — most existing accounts won't have this yet, since it's a new
  field) and it differs from the current `boxbuddy_locale` cookie, the cookie is updated to match
  the account's saved preference — so a user's language follows them to a new device/browser
  instead of being re-guessed from that device's own `Accept-Language` header. If the account has
  no saved preference yet, the cookie (set by auto-detection or a prior anonymous choice) is left
  as-is.

## Screens & Components

- **Settings** (`app/(app)/settings/page.tsx`): a new "Language" section with two buttons,
  "English" and "Español", next to the existing account section.
- Every page and component with static English text is updated to call `t(key)` (server) or
  `useTranslation()`'s `t` (client) instead of a hardcoded string: `app/login`, `app/signup`,
  `app/forgot-password`, `app/reset-password`, the dashboard (`app/(app)/page.tsx`), the item
  detail and edit pages, the scan page, `components/ItemForm.tsx` (including the field hints and
  placeholders added in the previous change), `components/ItemCard.tsx`, `components/EmptyState.tsx`,
  `components/SearchBar.tsx`, `components/DeleteItemButton.tsx`, and `components/BarcodePrintLabel.tsx`.
- Server-generated error strings (API route responses, `InvalidItemInputError` messages) are
  unchanged — displayed as-is in English, per Non-Goals.

## Error Handling

- Missing `Accept-Language` header (or a language BoxBuddy doesn't support): defaults to English.
- A malformed/tampered `boxbuddy_locale` cookie value (anything other than `"en"`/`"es"`): treated
  as absent, re-detected from `Accept-Language` on the next request.
- If saving the language to `user_metadata` fails (e.g. a transient Supabase error) while signed
  in, the cookie change still applies immediately — cross-device sync just doesn't happen for
  that one change. This is not surfaced as an error to the user, since the immediate UI change
  still succeeded.

## Testing

- Unit tests for the `Accept-Language`-parsing function (English default, Spanish variants like
  `es-MX`, malformed headers, absent header).
- Unit test asserting `en.ts` and `es.ts` export the exact same set of keys.
- Manual verification: open the app with the browser's language set to Spanish → the whole UI
  renders in Spanish; switch to English in Settings → changes immediately; log out and back in
  with a different account on the same browser → respects that account's own saved preference
  (or re-detects, if that account never chose one); simulate "another device" (a private/incognito
  window) logging into an account that already chose Spanish → opens in Spanish automatically.
