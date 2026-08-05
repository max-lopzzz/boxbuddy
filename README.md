# BoxBuddy

Small-business inventory tracker with QR code generation/scanning, cost/price/margin
tracking, and low-stock alerts. See `docs/superpowers/specs/2026-08-04-inventory-tracker-design.md`
for the full design.

**Live app:** https://boxbuddy-nine.vercel.app/login

## Local development

BoxBuddy uses [Supabase Auth](https://supabase.com/docs/guides/auth) for accounts: sign-up is
open (anyone can create an account), and each account has its own completely private
inventory — no user can see, edit, or delete another account's items.

1. Copy `.env.example` to `.env.local` and fill in the four Supabase variables:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project's
     Settings → API. Server-side only; never expose these to the browser.
   - `NEXT_PUBLIC_SUPABASE_URL` — the same value as `SUPABASE_URL`, re-declared under the
     `NEXT_PUBLIC_` prefix Next.js requires for client-side exposure.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Publishable/anon key from Settings → API →
     API Keys. Safe to expose to the browser; used only for Supabase Auth (sign-up, login,
     logout, password reset) — all inventory data access still goes through this app's own
     API routes using the service-role key.
2. Set up the database:
   - **Fresh Supabase project:** run `supabase/schema.sql` in the project's SQL Editor. It
     creates the `items` table (scoped to `owner_id`, with a private `photos` storage
     bucket) from scratch.
   - **Existing project** (e.g. one that predates per-user accounts): `schema.sql` only
     describes the fresh-project target state, not an upgrade path. Use the `alter table`
     migration in `docs/superpowers/plans/2026-08-05-multi-user-accounts.md` (Task 2, Step 2)
     instead — it adds `owner_id`, drops the old global `qr_code` uniqueness constraint in
     favor of a per-owner one, and deletes any pre-existing test data that has no owner.
3. Configure the Supabase dashboard (needed for both fresh and existing projects):
   - **Authentication → Providers → Email:** turn **off** "Confirm email", so sign-up logs
     a new user in immediately instead of requiring an email confirmation step.
   - **Authentication → URL Configuration:** add these to **Redirect URLs** (needed for the
     password-reset email link to work):
     - `http://localhost:3000/reset-password`
     - `https://boxbuddy-nine.vercel.app/reset-password` (or your deployed domain)
4. `npm install`
5. `npm run dev`, then visit `http://localhost:3000`.

## Testing

`npm test` runs all unit tests (via Vitest). Integration tests that touch Supabase
(`tests/lib/*.integration.test.ts`) are skipped automatically unless `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set in the environment.

## Deployment

Deployed on Vercel, connected to this repository. `npm run build` also regenerates the PWA
icons (`npm run generate-icons`) before building. Environment variables are set in the
Vercel project settings — the same four Supabase variables listed in `.env.example`
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Every push to `master` auto-deploys.
