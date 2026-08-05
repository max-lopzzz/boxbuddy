# BoxBuddy

Small-business inventory tracker with QR code generation/scanning, cost/price/margin
tracking, and low-stock alerts. See `docs/superpowers/specs/2026-08-04-inventory-tracker-design.md`
for the full design.

## Local development

1. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (Settings → API)
   - `APP_PASSCODE`: any starting passcode. It only seeds the database the first time
     `app_settings` is empty — after first login the passcode lives in the database and
     can be changed from Settings.
   - `SESSION_SECRET`: a random 32+ byte secret used to sign session cookies. Generate with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Run the schema in `supabase/schema.sql` against your Supabase project's SQL Editor.
3. `npm install`
4. `npm run dev`, then visit `http://localhost:3000`.

## Testing

`npm test` runs all unit tests (via Vitest). Integration tests that touch Supabase
(`tests/lib/*.integration.test.ts`) are skipped automatically unless `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set in the environment.

## Deployment

Deployed on Vercel, connected to this repository. `npm run build` also regenerates the PWA
icons (`npm run generate-icons`) before building. Environment variables are set in the
Vercel project settings — the same four variables listed in `.env.example`
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSCODE`, `SESSION_SECRET`). Every push
to `main` auto-deploys.
