# BoxBuddy — Multi-User Accounts Design

## Overview

BoxBuddy currently uses a single shared passcode for one person accessing one shared
inventory across their own devices. This design replaces that with individual accounts
(email + password, via Supabase Auth) so multiple people — each with their own private
inventory — can use the same deployed app. This is the first of two follow-on specs; a
second spec covers Spanish/English bilingual support and builds on top of this one.

## Goals

- Anyone can sign up with an email + password (open sign-up, no invite/allowlist).
- Each account has its own private inventory, invisible to other accounts.
- No email verification step required to start using the app after signing up.
- A working "forgot password" flow (self-serve, no developer intervention needed).
- Remove the old single-passcode system entirely — no admin backdoor kept.
- Preserve the existing "browser never talks to the database directly" architecture for
  all inventory data — only authentication itself talks to Supabase from the browser.

## Non-Goals

- Shared/collaborative inventories (each account's items are private to that account).
- Invite-only sign-up, admin-managed account creation, or any allowlist.
- Preserving old test data — existing items in the live database are deleted before this
  ships (they were created during development, not real inventory).
- Automatically invalidating other open sessions when a password changes (a known
  limitation of using a managed auth provider's default behavior — see Error Handling).
- Any change to the Spanish/English translation — covered by a separate spec.

## Architecture

- **Authentication**: Supabase Auth (email + password), called directly from the browser
  via a new client-side Supabase client using the public "anon" key (safe to expose — this
  key alone cannot read or write inventory data, since the `items` table has row level
  security enabled with no policies defined, which denies all direct access by default;
  all inventory access still happens through our own server-side API routes using the
  service-role key, which bypasses RLS, exactly as before).
- **Session freshness**: a new `middleware.ts` refreshes the Supabase Auth session cookie
  on every request (Supabase's standard Next.js integration pattern), using the
  `@supabase/ssr` package.
- **Server-side identity verification**: API routes and the `(app)` layout guard read the
  verified user from the Supabase Auth session (via `@supabase/ssr`'s server client)
  instead of the old `hasValidSession()`/passcode-based check.
- **Data access**: unchanged pattern — every read/write still goes through
  `lib/supabase.ts`'s service-role client, server-side only. The only change is every
  query now includes `owner_id = <verified user's id>`.
- **Removed entirely**: `lib/session.ts`, `lib/passcode.ts`, `lib/rate-limit.ts`, the
  `app/api/auth/login|logout|change-passcode` routes, the `login_attempts` and
  `app_settings` tables, and `APP_PASSCODE`/`SESSION_SECRET` env vars. Supabase Auth
  provides its own login rate limiting, session cookie signing, and password storage.
- **New dependency**: `@supabase/ssr`.
- **New env vars**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both
  safe for client exposure — the anon key is a public key by design). `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` remain, server-only, as before.

## Data Model Changes

- `items` gains a new column: `owner_id uuid not null references auth.users(id) on delete
  cascade`. Deleting a Supabase Auth user automatically deletes their items.
- The `qr_code` uniqueness constraint changes from globally unique to
  `unique(owner_id, qr_code)`. Rationale: two different people scanning the same
  manufacturer barcode (e.g. the same brand of screws) is a legitimate, expected
  collision across separate private inventories — it must not be blocked. A single
  account still cannot reuse a code across two of their own items.
- `login_attempts` and `app_settings` tables are dropped.
- All `lib/items.ts` functions (`listItems`, `getItem`, `createItem`, `updateItem`,
  `deleteItem`, `lookupByCode`, `autocompleteValues`) take the caller's `ownerId` and
  filter/write with it — there is no code path that omits this filter, since these
  functions are the only DB access point for items.

## Screens & Components

- **Sign up** (`/signup`) — email, password, confirm password. On success, the user is
  signed in immediately and redirected to the Dashboard.
- **Login** (`/login`) — email + password, replacing the passcode field. Adds a
  "Forgot password?" link. Wrong credentials show Supabase Auth's generic "Invalid login
  credentials" message (deliberately not revealing whether the email exists).
- **Forgot password** (`/forgot-password`) — email field; triggers Supabase Auth's
  built-in password-reset email.
- **Reset password** (`/reset-password`) — the page the emailed link lands on; sets a new
  password via Supabase Auth's `updateUser`.
- **Settings** — the old "change passcode" form is replaced with an account section:
  displays the user's email, a "change password" field (new password only — no need to
  re-enter the current one, since the session is already authenticated), and the existing
  "Log out" button (now calling Supabase Auth's sign-out).
- Every other existing screen (Dashboard, item forms, item detail, scan, print label) is
  unchanged in appearance and behavior — the only difference is every API call implicitly
  operates on the signed-in user's own items.

## Error Handling

- **No session** on a protected page → redirect to `/login` (unchanged pattern).
- **No session** on a protected API route → 401 (unchanged pattern).
- **Wrong email/password**: inline error, generic message (Supabase Auth's default,
  intentionally not distinguishing "wrong password" from "no such account").
- **Duplicate sign-up email**: inline error from Supabase Auth.
- **Password reset email for a nonexistent address**: Supabase Auth does not reveal
  whether the email exists (shows a generic "check your email" message regardless, to
  avoid leaking which emails have accounts).
- **Cross-user data isolation**: every item read/write is filtered by `owner_id`; a
  request for another user's item id returns 404 (indistinguishable from a nonexistent
  id), never that item's data.
- **Known limitation**: changing a password does not retroactively invalidate other
  already-open sessions on other devices — this is Supabase Auth's default behavior, not
  something practical to change without extra complexity, and is a reasonable tradeoff at
  this app's scale (a small group of trusted users, not a high-security target).

## Testing

- Unit tests for any new pure logic (e.g. per-owner uniqueness helpers, if extracted).
- Integration tests against the real Supabase project (same live-credential pattern used
  throughout this codebase): sign-up creates an isolated inventory; one account cannot
  read, update, or delete another account's items; two different accounts can use the
  same `qr_code` without conflict; one account cannot reuse its own `qr_code`.
- Manual verification: full sign-up → login → add an item → log out → sign up a second
  test account → confirm the second account's Dashboard is empty (not showing the first
  account's items) → confirm switching back to the first account still shows its items.
