# BoxBuddy Inventory Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build BoxBuddy, a mobile-friendly PWA for small-business inventory tracking with QR code generation/scanning, cost/price/margin and low-stock tracking, and a single-passcode login, deployed on Vercel with a Supabase Postgres + Storage backend.

**Architecture:** Next.js (App Router, TypeScript) serves both the UI and the API routes; the browser never talks to Supabase directly — every DB/storage call goes through a Next.js API route gated by a signed session cookie. Supabase Postgres holds a single `items` table plus two small support tables (`app_settings` for the passcode hash, `login_attempts` for rate limiting); Supabase Storage holds item photos in a private bucket served via signed URLs.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3, Vitest 1, `@supabase/supabase-js` 2, `qrcode` (generation), `html5-qrcode` (scanning), `next-pwa` (installable app shell), `sharp` (icon generation, dev-only), Node.js >= 18.18.

## Global Constraints

- Single shared passcode auth only — no per-user accounts, no user table. The passcode itself lives as a salted hash in a one-row `app_settings` table (not a raw env var comparison), so it can be changed at runtime from Settings.
- Generated QR codes encode only the short `qr_code` string (e.g. `bb_x7f2a9`), never a full URL, so they keep working if the deployment domain changes.
- Photo uploads are capped at 5MB, enforced both client-side (before upload) and server-side (in the API route).
- The login endpoint is rate-limited to 5 attempts per minute per IP, tracked via a `login_attempts` table (not in-memory, since Vercel serverless functions are not guaranteed to share memory across invocations).
- `location` and `category` are plain free-text fields with autocomplete sourced from existing distinct values — no separate normalized tables in v1.
- Concurrent edits from two devices use last-write-wins (no optimistic locking) — acceptable at single-location small-business scale.
- Full offline data editing/sync is out of scope for v1; only the PWA app shell needs to load offline.
- All Supabase access (the service role key) is server-side only — API routes and Server Components. It must never reach client-side code or the browser bundle.
- API routes that use `node:crypto` or the Supabase service role key must run on the Node.js runtime (the default) — do not set `export const runtime = "edge"` on them.

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx` (temporary placeholder, replaced in Task 12)
- Create: `.env.example`
- Create: `.gitignore`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm run dev`, `npm run build`, and `npm test` in this repo, which every later task assumes exist.

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
cd "/Users/hanniamabellopezmontano/Library/Mobile Documents/com~apple~CloudDocs/boxbuddy"
npm init -y
npm install next@^14 react@^18 react-dom@^18 @supabase/supabase-js@^2 qrcode@^1.5 html5-qrcode@^2.3 next-pwa@^5.6
npm install -D typescript@^5 @types/react@^18 @types/node@^20 @types/qrcode@^1.5 tailwindcss@^3 postcss@^8 autoprefixer@^10 vitest@^1 sharp@^0.33
```

- [ ] **Step 2: Add npm scripts to `package.json`**

Edit the generated `package.json` so the `"scripts"` key reads:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "npm run generate-icons && next build",
    "start": "next start",
    "test": "vitest run",
    "generate-icons": "node scripts/generate-icons.js"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.js`**

```js
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
  reactStrictMode: true,
});
```

- [ ] **Step 5: Create Tailwind config**

`postcss.config.js`:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create root layout `app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BoxBuddy",
  description: "Small-business inventory tracker",
  manifest: "/manifest.json",
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-orange-50 text-stone-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create a temporary placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return <main className="p-8">BoxBuddy — setup in progress.</main>;
}
```

(This is replaced by the real Dashboard in Task 12.)

- [ ] **Step 9: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 10: Write a smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from "vitest";

describe("project setup", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 11: Run the smoke test**

Run: `npm test`
Expected: 1 passed test (`project setup > runs a basic assertion`).

- [ ] **Step 12: Create `.env.example`**

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Used only to seed the passcode the very first time app_settings is empty.
# After first login, the passcode lives in the database and can be changed from Settings.
APP_PASSCODE=

# Random 32+ byte secret used to sign session cookies. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=
```

- [ ] **Step 13: Create `.gitignore`**

```
node_modules
.next
.env.local
public/sw.js
public/workbox-*.js
public/icons
```

- [ ] **Step 14: Verify the app builds and runs**

Run: `npm run build`
Expected: build fails only on the missing `generate-icons` script target (created in Task 17) — if it fails for that reason, temporarily comment out the `generate-icons &&` prefix in `package.json`'s `build` script, confirm `next build` succeeds, then restore it before committing (Task 17 will make it real).

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with TypeScript, Tailwind, and Vitest"
```

---

## Task 2: Supabase project, schema, and server client

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`
- Test: `tests/lib/supabase.test.ts`

**Interfaces:**
- Produces: `getSupabaseClient(): SupabaseClient` (lib/supabase.ts), `Item` and `ItemInput` types (lib/types.ts) used by every later task that touches items.

- [ ] **Step 1: Create the Supabase project (manual, external account)**

Go to https://supabase.com, create a free account and a new project (region close to you). This is an external account signup, so do this step yourself. Once created, note down:
- Project URL (Settings → API → Project URL) → this is `SUPABASE_URL`
- Service role key (Settings → API → service_role secret) → this is `SUPABASE_SERVICE_ROLE_KEY`

Create `.env.local` (not committed, already in `.gitignore`) with:

```bash
SUPABASE_URL=<your project URL>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
APP_PASSCODE=<pick any starter passcode, e.g. a 6-digit number>
SESSION_SECRET=<output of the node -e command from Task 1 Step 12>
```

- [ ] **Step 2: Write the schema**

```sql
-- supabase/schema.sql
create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  qr_code text not null unique,
  sku text,
  name text not null,
  quantity integer not null default 0,
  reorder_at integer,
  location text,
  category text,
  notes text,
  cost numeric,
  price numeric,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_location_idx on items (location);
create index if not exists items_category_idx on items (category);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
before update on items
for each row
execute function set_updated_at();

create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_ip_created_idx on login_attempts (ip, created_at);

create table if not exists app_settings (
  id int primary key default 1,
  passcode_hash text not null,
  passcode_salt text not null,
  constraint app_settings_singleton check (id = 1)
);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
```

- [ ] **Step 3: Run the schema against your Supabase project**

In the Supabase Dashboard, open the SQL Editor, paste the full contents of `supabase/schema.sql`, and run it.
Expected: no errors; the Table Editor now shows `items`, `login_attempts`, and `app_settings`, and Storage shows a private `photos` bucket.

- [ ] **Step 4: Create shared types**

```ts
// lib/types.ts
export interface Item {
  id: string;
  qr_code: string;
  sku: string | null;
  name: string;
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ItemInput = {
  name: string;
  sku: string | null;
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  qr_code?: string;
  photo_url?: string | null;
};
```

- [ ] **Step 5: Create the Supabase server client helper**

```ts
// lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
```

- [ ] **Step 6: Write an integration test that confirms the connection and schema**

```ts
// tests/lib/supabase.test.ts
import { describe, it, expect } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("Supabase connection", () => {
  it("can query the items table", async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("items").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("can query the app_settings table", async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("app_settings").select("id").limit(1);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 7: Run the test with real credentials loaded**

Run: `SUPABASE_URL=$(grep SUPABASE_URL .env.local | cut -d= -f2) SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2) npm test -- tests/lib/supabase.test.ts`
Expected: both tests pass. If the project already loads `.env.local` automatically in your setup, plain `npm test -- tests/lib/supabase.test.ts` also works.

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql lib/types.ts lib/supabase.ts tests/lib/supabase.test.ts
git commit -m "Add Supabase schema and server client helper"
```

---

## Task 3: Session token helpers

**Files:**
- Create: `lib/session.ts`
- Test: `tests/lib/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createSessionToken(): string`, `verifySessionToken(token: string | undefined | null): boolean`, `SESSION_COOKIE_NAME: string`, `SESSION_MAX_AGE_SECONDS: number` — used by Task 5 (login route, auth guard).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/session.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken } from "../../lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-do-not-use-in-prod";
});

describe("session token", () => {
  it("creates a token that verifies as valid", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken();
    const tampered = token.slice(0, -2) + "xx";
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects an empty or missing token", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken(null)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("rejects an expired token", () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 200 * 24 * 60 * 60 * 1000;
    const oldToken = createSessionToken();
    Date.now = realNow;
    expect(verifySessionToken(oldToken)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/lib/session.test.ts`
Expected: FAIL with "Cannot find module '../../lib/session'".

- [ ] **Step 3: Implement `lib/session.ts`**

```ts
// lib/session.ts
import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "bb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(payloadB64: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/lib/session.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts tests/lib/session.test.ts
git commit -m "Add signed session token helpers"
```

---

## Task 4: Passcode storage and login rate limiting

**Files:**
- Create: `lib/passcode.ts`
- Create: `lib/rate-limit.ts`
- Test: `tests/lib/passcode.integration.test.ts`
- Test: `tests/lib/rate-limit.integration.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` (Task 2).
- Produces: `verifyPasscode(passcode: string): Promise<boolean>`, `setPasscode(passcode: string): Promise<void>`, `isRateLimited(ip: string): Promise<boolean>`, `recordLoginAttempt(ip: string): Promise<void>` — used by Task 5.

- [ ] **Step 1: Implement `lib/passcode.ts`**

```ts
// lib/passcode.ts
import crypto from "node:crypto";
import { getSupabaseClient } from "./supabase";

function hashPasscode(passcode: string, salt: string): string {
  return crypto.scryptSync(passcode, salt, 64).toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function getStoredPasscode(): Promise<{ hash: string; salt: string } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("passcode_hash, passcode_salt")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { hash: data.passcode_hash, salt: data.passcode_salt };
}

export async function setPasscode(passcode: string): Promise<void> {
  const supabase = getSupabaseClient();
  const salt = generateSalt();
  const hash = hashPasscode(passcode, salt);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, passcode_hash: hash, passcode_salt: salt });
  if (error) throw error;
}

async function ensurePasscodeInitialized(): Promise<void> {
  const existing = await getStoredPasscode();
  if (existing) return;
  const initial = process.env.APP_PASSCODE;
  if (!initial) {
    throw new Error("APP_PASSCODE must be set to initialize the passcode for the first time");
  }
  await setPasscode(initial);
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  await ensurePasscodeInitialized();
  const stored = await getStoredPasscode();
  if (!stored) return false;
  const hash = hashPasscode(passcode, stored.salt);
  const a = Buffer.from(hash);
  const b = Buffer.from(stored.hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Write the passcode integration test**

```ts
// tests/lib/passcode.integration.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
import { verifyPasscode, setPasscode } from "../../lib/passcode";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("passcode storage (integration)", () => {
  afterAll(async () => {
    // Restore the original .env.local APP_PASSCODE so login keeps working after this test run.
    if (process.env.APP_PASSCODE) {
      await setPasscode(process.env.APP_PASSCODE);
    }
  });

  it("initializes from APP_PASSCODE on first use and verifies correctly", async () => {
    const supabase = getSupabaseClient();
    await supabase.from("app_settings").delete().eq("id", 1);
    expect(await verifyPasscode(process.env.APP_PASSCODE!)).toBe(true);
    expect(await verifyPasscode("definitely-wrong")).toBe(false);
  });

  it("setPasscode changes what verifies successfully", async () => {
    await setPasscode("a-new-test-passcode");
    expect(await verifyPasscode("a-new-test-passcode")).toBe(true);
    expect(await verifyPasscode(process.env.APP_PASSCODE!)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the passcode test**

Run: `npm test -- tests/lib/passcode.integration.test.ts`
Expected: PASS, 2 tests (requires `.env.local` credentials from Task 2).

- [ ] **Step 4: Implement `lib/rate-limit.ts`**

```ts
// lib/rate-limit.ts
import { getSupabaseClient } from "./supabase";

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function isRateLimited(ip: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) >= MAX_ATTEMPTS;
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("login_attempts").insert({ ip });
  if (error) throw error;
}
```

- [ ] **Step 5: Write the rate-limit integration test**

```ts
// tests/lib/rate-limit.integration.test.ts
import { describe, it, expect } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
import { isRateLimited, recordLoginAttempt } from "../../lib/rate-limit";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEST_IP = "203.0.113.5"; // TEST-NET-3, reserved for documentation/testing

describe.skipIf(!hasEnv)("rate limiting (integration)", () => {
  it("is not rate limited before any attempts", async () => {
    const supabase = getSupabaseClient();
    await supabase.from("login_attempts").delete().eq("ip", TEST_IP);
    expect(await isRateLimited(TEST_IP)).toBe(false);
  });

  it("becomes rate limited after 5 attempts within the window", async () => {
    for (let i = 0; i < 5; i++) {
      await recordLoginAttempt(TEST_IP);
    }
    expect(await isRateLimited(TEST_IP)).toBe(true);
  });
});
```

- [ ] **Step 6: Run the rate-limit test**

Run: `npm test -- tests/lib/rate-limit.integration.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/passcode.ts lib/rate-limit.ts tests/lib/passcode.integration.test.ts tests/lib/rate-limit.integration.test.ts
git commit -m "Add DB-backed passcode storage and login rate limiting"
```

---

## Task 5: Login/logout/change-passcode routes, login page, and auth guard

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/change-passcode/route.ts`
- Create: `app/login/page.tsx`
- Create: `app/(app)/layout.tsx`
- Move: `app/page.tsx` → `app/(app)/page.tsx` (placeholder content unchanged; real Dashboard replaces it in Task 12)

**Interfaces:**
- Consumes: `createSessionToken`, `verifySessionToken`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS` (Task 3); `verifyPasscode` (Task 4); `isRateLimited`, `recordLoginAttempt` (Task 4).
- Produces: `hasValidSession(): boolean` (lib/auth.ts) — used by every API route from Task 9 onward and by the `(app)` layout.

- [ ] **Step 1: Implement `lib/auth.ts`**

```ts
// lib/auth.ts
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

export function hasValidSession(): boolean {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
```

- [ ] **Step 2: Implement the login route**

```ts
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../../../lib/session";
import { verifyPasscode } from "../../../../lib/passcode";
import { isRateLimited, recordLoginAttempt } from "../../../../lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const { passcode } = await request.json();
  await recordLoginAttempt(ip);

  if (typeof passcode !== "string" || !(await verifyPasscode(passcode))) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const token = createSessionToken();
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement the logout route**

```ts
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function POST() {
  cookies().delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Implement the change-passcode route**

```ts
// app/api/auth/change-passcode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { verifyPasscode, setPasscode } from "../../../../lib/passcode";

export async function POST(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { current, next } = await request.json();
  if (typeof current !== "string" || !(await verifyPasscode(current))) {
    return NextResponse.json({ error: "Current passcode is incorrect" }, { status: 401 });
  }
  if (typeof next !== "string" || next.length < 4) {
    return NextResponse.json({ error: "New passcode must be at least 4 characters" }, { status: 400 });
  }
  await setPasscode(next);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create the login page**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Image src="/illustrations/logo.png" alt="BoxBuddy" width={120} height={120} />
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="rounded-lg border border-orange-300 p-3 text-center text-lg"
          autoFocus
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
```

(This references `/illustrations/logo.png`, which is added in Task 11. The page still renders correctly without it — `next/image` shows a broken-image icon until then.)

- [ ] **Step 6: Move the placeholder Dashboard into the auth-guarded route group**

```bash
mkdir -p "app/(app)"
git mv app/page.tsx "app/(app)/page.tsx"
```

- [ ] **Step 7: Create the auth guard layout for the `(app)` group**

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { hasValidSession } from "../../lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasValidSession()) {
    redirect("/login");
  }
  return <>{children}</>;
}
```

- [ ] **Step 8: Manually verify the auth flow in the browser**

Run: `npm run dev`
- Visit `http://localhost:3000/` — expect a redirect to `/login`.
- Enter the wrong passcode — expect an inline "Incorrect passcode" error.
- Enter the correct passcode (the `APP_PASSCODE` value from `.env.local`) — expect a redirect to `/` showing the placeholder Dashboard text.
- Enter 5 wrong passcodes in under a minute, then try a 6th — expect "Too many attempts. Try again in a minute."

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add passcode login, logout, change-passcode, and auth guard"
```

---

## Task 6: Pure item helpers

**Files:**
- Create: `lib/item-helpers.ts`
- Test: `tests/lib/item-helpers.test.ts`

**Interfaces:**
- Produces: `computeMargin(cost: number | null, price: number | null): number | null`, `isLowStock(quantity: number, reorderAt: number | null): boolean` — used by Task 12 (Dashboard) and Task 14 (Item detail).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/item-helpers.test.ts
import { describe, it, expect } from "vitest";
import { computeMargin, isLowStock } from "../../lib/item-helpers";

describe("computeMargin", () => {
  it("returns price minus cost when both are set", () => {
    expect(computeMargin(2.5, 9.99)).toBe(7.49);
  });

  it("returns null when cost is null", () => {
    expect(computeMargin(null, 9.99)).toBeNull();
  });

  it("returns null when price is null", () => {
    expect(computeMargin(2.5, null)).toBeNull();
  });
});

describe("isLowStock", () => {
  it("is false when reorderAt is null", () => {
    expect(isLowStock(0, null)).toBe(false);
  });

  it("is true when quantity is at or below reorderAt", () => {
    expect(isLowStock(2, 2)).toBe(true);
    expect(isLowStock(1, 2)).toBe(true);
  });

  it("is false when quantity is above reorderAt", () => {
    expect(isLowStock(3, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/lib/item-helpers.test.ts`
Expected: FAIL with "Cannot find module '../../lib/item-helpers'".

- [ ] **Step 3: Implement `lib/item-helpers.ts`**

```ts
// lib/item-helpers.ts
export function computeMargin(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null) return null;
  return Math.round((price - cost) * 100) / 100;
}

export function isLowStock(quantity: number, reorderAt: number | null): boolean {
  if (reorderAt === null) return false;
  return quantity <= reorderAt;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/lib/item-helpers.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/item-helpers.ts tests/lib/item-helpers.test.ts
git commit -m "Add margin and low-stock pure helpers"
```

---

## Task 7: QR code generation and rendering

**Files:**
- Create: `lib/qr.ts`
- Test: `tests/lib/qr.test.ts`

**Interfaces:**
- Consumes: nothing (the "does this code already exist" check is injected as a function parameter, so this module has no DB dependency).
- Produces: `generateCandidateCode(): string`, `generateUniqueCode(codeExists: (code: string) => Promise<boolean>): Promise<string>`, `renderQrSvg(code: string): Promise<string>` — used by Task 8 (items DB layer) and Task 14 (item detail page).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/qr.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateCandidateCode, generateUniqueCode, renderQrSvg } from "../../lib/qr";

describe("generateCandidateCode", () => {
  it("starts with bb_ and has 8 characters after the prefix", () => {
    const code = generateCandidateCode();
    expect(code.startsWith("bb_")).toBe(true);
    expect(code.length).toBe(3 + 8);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCandidateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateUniqueCode", () => {
  it("returns the first candidate when it does not exist yet", async () => {
    const codeExists = vi.fn().mockResolvedValue(false);
    const code = await generateUniqueCode(codeExists);
    expect(codeExists).toHaveBeenCalledTimes(1);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("retries when a candidate already exists", async () => {
    const codeExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await generateUniqueCode(codeExists);
    expect(codeExists).toHaveBeenCalledTimes(2);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("throws after 10 failed attempts", async () => {
    const codeExists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueCode(codeExists)).rejects.toThrow(
      "Could not generate a unique QR code after 10 attempts"
    );
  });
});

describe("renderQrSvg", () => {
  it("renders an SVG string", async () => {
    const svg = await renderQrSvg("bb_abc12345");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/lib/qr.test.ts`
Expected: FAIL with "Cannot find module '../../lib/qr'".

- [ ] **Step 3: Implement `lib/qr.ts`**

```ts
// lib/qr.ts
import crypto from "node:crypto";
import QRCode from "qrcode";

const CODE_PREFIX = "bb_";
const CODE_LENGTH = 8;
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"; // no ambiguous chars (0/1/o/l excluded)

export function generateCandidateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueCode(
  codeExists: (code: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCandidateCode();
    if (!(await codeExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique QR code after 10 attempts");
}

export async function renderQrSvg(code: string): Promise<string> {
  return QRCode.toString(code, { type: "svg", margin: 1 });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/lib/qr.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/qr.ts tests/lib/qr.test.ts
git commit -m "Add QR code generation and SVG rendering"
```

---

## Task 8: Items database layer

**Files:**
- Create: `lib/items.ts`
- Test: `tests/lib/items.integration.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` (Task 2), `Item`/`ItemInput` (Task 2), `generateUniqueCode` (Task 7).
- Produces: `listItems(search?: string): Promise<Item[]>`, `getItem(id: string): Promise<Item | null>`, `lookupByCode(code: string): Promise<Item | null>`, `createItem(input: ItemInput): Promise<Item>`, `updateItem(id: string, input: Partial<ItemInput>): Promise<Item>`, `deleteItem(id: string): Promise<void>`, `autocompleteValues(field: "location" | "category", search: string): Promise<string[]>` — used by Task 9 (API routes) and Task 10 (photo route).

- [ ] **Step 1: Implement `lib/items.ts`**

```ts
// lib/items.ts
import { getSupabaseClient } from "./supabase";
import { generateUniqueCode } from "./qr";
import type { Item, ItemInput } from "./types";

export async function listItems(search?: string): Promise<Item[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from("items").select("*").order("updated_at", { ascending: false });
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

export async function lookupByCode(code: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").select("*").eq("qr_code", code).maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

async function codeExists(code: string): Promise<boolean> {
  return (await lookupByCode(code)) !== null;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const supabase = getSupabaseClient();
  const qr_code = input.qr_code ?? (await generateUniqueCode(codeExists));
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, qr_code })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function autocompleteValues(
  field: "location" | "category",
  search: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select(field)
    .ilike(field, `%${search}%`)
    .not(field, "is", null)
    .limit(50);
  if (error) throw error;
  const values = (data as Record<string, string>[]).map((row) => row[field]);
  return Array.from(new Set(values)).slice(0, 10);
}
```

- [ ] **Step 2: Write the integration test**

```ts
// tests/lib/items.integration.test.ts
import { describe, it, expect, afterAll } from "vitest";
import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
  lookupByCode,
  listItems,
} from "../../lib/items";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("items DB layer (integration)", () => {
  let createdId: string;

  it("creates an item with a generated qr_code", async () => {
    const item = await createItem({
      name: "Integration Test Widget",
      sku: "ITW-1",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: null,
      cost: 2.5,
      price: 9.99,
    });
    createdId = item.id;
    expect(item.qr_code.startsWith("bb_")).toBe(true);
    expect(item.name).toBe("Integration Test Widget");
  });

  it("finds the item by id", async () => {
    const item = await getItem(createdId);
    expect(item?.name).toBe("Integration Test Widget");
  });

  it("finds the item by qr_code", async () => {
    const created = await getItem(createdId);
    const found = await lookupByCode(created!.qr_code);
    expect(found?.id).toBe(createdId);
  });

  it("updates the item", async () => {
    const updated = await updateItem(createdId, { quantity: 5 });
    expect(updated.quantity).toBe(5);
  });

  it("lists items including the created one when searched by name", async () => {
    const items = await listItems("Integration Test Widget");
    expect(items.some((i) => i.id === createdId)).toBe(true);
  });

  it("rejects creating a second item with a duplicate qr_code", async () => {
    const existing = await getItem(createdId);
    await expect(
      createItem({
        name: "Duplicate Code Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing!.qr_code,
      })
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await deleteItem(createdId);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/lib/items.integration.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 4: Commit**

```bash
git add lib/items.ts tests/lib/items.integration.test.ts
git commit -m "Add items database layer with CRUD, lookup, and autocomplete"
```

---

## Task 9: Items API routes

**Files:**
- Create: `app/api/items/route.ts`
- Create: `app/api/items/[id]/route.ts`
- Create: `app/api/items/lookup-by-code/route.ts`
- Create: `app/api/items/autocomplete/route.ts`

**Interfaces:**
- Consumes: `hasValidSession()` (Task 5), `listItems`/`getItem`/`createItem`/`updateItem`/`deleteItem`/`lookupByCode`/`autocompleteValues` (Task 8).
- Produces: `GET/POST /api/items`, `GET/PATCH/DELETE /api/items/:id`, `GET /api/items/lookup-by-code?code=`, `GET /api/items/autocomplete?field=&q=` — used by Task 12 (Dashboard), Task 13 (forms), Task 14 (detail), Task 15 (scan).

- [ ] **Step 1: Implement the collection route**

```ts
// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../lib/auth";
import { listItems, createItem } from "../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const items = await listItems(search);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  try {
    const item = await createItem(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "This code is already used by another item." },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 2: Implement the single-item route**

```ts
// app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { getItem, updateItem, deleteItem } from "../../../../lib/items";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const item = await updateItem(params.id, body);
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteItem(params.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement the lookup-by-code route**

```ts
// app/api/items/lookup-by-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { lookupByCode } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const item = await lookupByCode(code);
  return NextResponse.json({ item });
}
```

- [ ] **Step 4: Implement the autocomplete route**

```ts
// app/api/items/autocomplete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { autocompleteValues } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const field = request.nextUrl.searchParams.get("field");
  const search = request.nextUrl.searchParams.get("q") ?? "";
  if (field !== "location" && field !== "category") {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }
  const values = await autocompleteValues(field, search);
  return NextResponse.json({ values });
}
```

- [ ] **Step 5: Manually verify the routes**

Run: `npm run dev`, then in another terminal (after logging in via the browser and copying the `bb_session` cookie value from devtools):

```bash
curl -s http://localhost:3000/api/items -H "Cookie: bb_session=<paste cookie value>" | head -c 300
```

Expected: `{"items":[]}` (empty array, since no items exist yet).

- [ ] **Step 6: Commit**

```bash
git add app/api/items
git commit -m "Add items API routes: list, create, get, update, delete, lookup, autocomplete"
```

---

## Task 10: Photo storage and photo API route

**Files:**
- Create: `lib/storage.ts`
- Create: `app/api/items/[id]/photo/route.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` (Task 2), `hasValidSession()` (Task 5), `getItem`/`updateItem` (Task 8).
- Produces: `uploadPhoto(itemId: string, file: File): Promise<string>`, `getSignedPhotoUrl(path: string): Promise<string>`, `GET/POST /api/items/:id/photo` — used by Task 12 (`ItemCard` thumbnails), Task 13 (`ItemForm` upload), Task 14 (item detail photo).

- [ ] **Step 1: Implement `lib/storage.ts`**

```ts
// lib/storage.ts
import { getSupabaseClient } from "./supabase";

const BUCKET = "photos";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function uploadPhoto(itemId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const path = `${itemId}/${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function getSignedPhotoUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Implement the photo route**

```ts
// app/api/items/[id]/photo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../../lib/auth";
import { uploadPhoto, getSignedPhotoUrl } from "../../../../../lib/storage";
import { getItem, updateItem } from "../../../../../lib/items";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(params.id);
  if (!item?.photo_url) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  const signedUrl = await getSignedPhotoUrl(item.photo_url);
  return NextResponse.redirect(signedUrl);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Photo must be 5MB or smaller" }, { status: 413 });
  }
  const path = await uploadPhoto(params.id, file);
  await updateItem(params.id, { photo_url: path });
  const signedUrl = await getSignedPhotoUrl(path);
  return NextResponse.json({ photo_url: path, signed_url: signedUrl });
}
```

- [ ] **Step 3: Manually verify photo upload**

With the dev server running and logged in (browser session cookie), create a test item via the API, then:

```bash
curl -s -X POST http://localhost:3000/api/items/<item-id>/photo \
  -H "Cookie: bb_session=<paste cookie value>" \
  -F "photo=@/path/to/any/small-test-image.jpg"
```

Expected: JSON response with `photo_url` and a working `signed_url`. Visiting `http://localhost:3000/api/items/<item-id>/photo` in a browser (while logged in) should redirect to and display the image.

- [ ] **Step 4: Commit**

```bash
git add lib/storage.ts app/api/items/[id]/photo
git commit -m "Add photo upload/serving via Supabase Storage"
```

---

## Task 11: Theme assets and EmptyState component

**Files:**
- Create: `public/illustrations/logo.png`
- Create: `public/illustrations/greet.png`
- Create: `public/illustrations/loading.png`
- Create: `public/illustrations/no-results.png`
- Create: `public/illustrations/random-deco.png`
- Create: `public/illustrations/writing.png`
- Create: `components/EmptyState.tsx`

**Interfaces:**
- Produces: `<EmptyState illustration="greet" | "no-results" | "loading" title subtitle? action? />` — used by Task 12 (Dashboard).

- [ ] **Step 1: Copy and rename the provided illustrations**

```bash
cd "/Users/hanniamabellopezmontano/Library/Mobile Documents/com~apple~CloudDocs/boxbuddy"
mkdir -p public/illustrations
cp "logo.png" "public/illustrations/logo.png"
cp "greet (left side of screen).png" "public/illustrations/greet.png"
cp "loading_searching.png" "public/illustrations/loading.png"
cp "no results.png" "public/illustrations/no-results.png"
cp "random deco.png" "public/illustrations/random-deco.png"
cp "writing.png" "public/illustrations/writing.png"
```

- [ ] **Step 2: Implement `EmptyState`**

```tsx
// components/EmptyState.tsx
import Image from "next/image";

const ILLUSTRATIONS = {
  greet: { src: "/illustrations/greet.png", alt: "A cat peeking around the corner" },
  "no-results": { src: "/illustrations/no-results.png", alt: "A sad cat sitting in an empty box" },
  loading: { src: "/illustrations/loading.png", alt: "A cat carrying a box" },
} as const;

export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { src, alt } = ILLUSTRATIONS[illustration];
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <Image src={src} alt={alt} width={200} height={200} />
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 3: Manually verify the images loaded correctly**

Run: `npm run dev`, visit `http://localhost:3000/login` in a browser, confirm the logo renders (not a broken-image icon).

- [ ] **Step 4: Commit**

```bash
git add public/illustrations components/EmptyState.tsx
git commit -m "Add theme illustrations and EmptyState component"
```

---

## Task 12: Dashboard page, ItemCard, and SearchBar

**Files:**
- Create: `components/ItemCard.tsx`
- Create: `components/SearchBar.tsx`
- Modify: `app/(app)/page.tsx` (replace placeholder with the real Dashboard)

**Interfaces:**
- Consumes: `isLowStock` (Task 6), `EmptyState` (Task 11), `Item` type (Task 2), `GET /api/items` (Task 9).
- Produces: the Dashboard route (`/`) used as the post-login landing page; `<ItemCard item />` and `<SearchBar onSearch />` reused nowhere else in this plan but kept as standalone components for clarity.

- [ ] **Step 1: Implement `ItemCard`**

```tsx
// components/ItemCard.tsx
import Link from "next/link";
import type { Item } from "../lib/types";
import { isLowStock } from "../lib/item-helpers";

export function ItemCard({ item }: { item: Item }) {
  const low = isLowStock(item.quantity, item.reorder_at);
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex items-center gap-3 rounded-xl border border-orange-100 bg-white p-3 shadow-sm"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-orange-50 text-2xl">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/items/${item.id}/photo`}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          "📦"
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-stone-800">{item.name}</p>
        <p className="text-sm text-stone-500">
          Qty {item.quantity}
          {item.location ? ` · ${item.location}` : ""}
        </p>
      </div>
      {low && (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          Low stock
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Implement `SearchBar`**

```tsx
// components/SearchBar.tsx
"use client";

import { useEffect, useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timeout);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      placeholder="Search by name or SKU"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-orange-200 p-3"
    />
  );
}
```

- [ ] **Step 3: Replace the placeholder Dashboard**

```tsx
// app/(app)/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ItemCard } from "../../components/ItemCard";
import { SearchBar } from "../../components/SearchBar";
import { EmptyState } from "../../components/EmptyState";
import { isLowStock } from "../../lib/item-helpers";
import type { Item } from "../../lib/types";

export default function DashboardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [search, setSearch] = useState("");

  const fetchItems = useCallback(async (query: string) => {
    setItems(null);
    const url = query ? `/api/items?search=${encodeURIComponent(query)}` : "/api/items";
    const res = await fetch(url);
    const body = await res.json();
    setItems(body.items ?? []);
  }, []);

  useEffect(() => {
    fetchItems(search);
  }, [search, fetchItems]);

  const totalCostValue = items?.reduce((sum, i) => sum + (i.cost ?? 0) * i.quantity, 0) ?? 0;
  const lowStockCount = items?.filter((i) => isLowStock(i.quantity, i.reorder_at)).length ?? 0;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Items" value={items?.length ?? "…"} />
        <SummaryCard label="Cost value" value={`$${totalCostValue.toFixed(2)}`} />
        <SummaryCard label="Low stock" value={lowStockCount} />
      </div>

      <SearchBar onSearch={setSearch} />

      {items === null && <EmptyState illustration="loading" title="Loading your inventory…" />}

      {items !== null && items.length === 0 && search === "" && (
        <EmptyState
          illustration="greet"
          title="No items yet"
          subtitle="Add your first item to get started."
          action={
            <Link href="/items/new" className="rounded-lg bg-orange-400 px-4 py-2 text-white">
              Add item
            </Link>
          }
        />
      )}

      {items !== null && items.length === 0 && search !== "" && (
        <EmptyState illustration="no-results" title={`No matches for "${search}"`} />
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
        <Link href="/scan" className="rounded-full bg-stone-800 px-5 py-3 text-white shadow-lg">
          Scan
        </Link>
        <Link href="/items/new" className="rounded-full bg-orange-400 px-5 py-3 text-white shadow-lg">
          Add item
        </Link>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-orange-50 p-3 text-center">
      <p className="text-lg font-semibold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, log in, confirm:
- With zero items: the `greet` empty state shows with an "Add item" button (the `/items/new` link 404s until Task 13 — that's expected here).
- Summary cards show `0` items, `$0.00` cost value, `0` low stock.
- Typing in the search bar (once items exist, after Task 13) filters the list; typing a query with no matches shows the `no-results` state.

- [ ] **Step 5: Commit**

```bash
git add components/ItemCard.tsx components/SearchBar.tsx "app/(app)/page.tsx"
git commit -m "Add Dashboard page with summary cards, search, and empty states"
```

---

## Task 13: ItemForm, AutocompleteInput, and Add/Edit pages

**Files:**
- Create: `components/AutocompleteInput.tsx`
- Create: `components/ItemForm.tsx`
- Create: `app/(app)/items/new/page.tsx`
- Create: `app/(app)/items/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `Item`/`ItemInput` (Task 2), `GET /api/items/autocomplete`, `POST /api/items`, `PATCH /api/items/:id`, `POST /api/items/:id/photo` (Tasks 9–10), `getItem` (Task 8).
- Produces: `<ItemForm item? prefillCode? />` — used directly by the new/edit pages; also consumed conceptually by Task 15 (Scan page links to `/items/new?code=...`).

- [ ] **Step 1: Implement `AutocompleteInput`**

```tsx
// components/AutocompleteInput.tsx
"use client";

import { useEffect, useState } from "react";

export function AutocompleteInput({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "location" | "category";
  value: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/items/autocomplete?field=${field}&q=${encodeURIComponent(value)}`);
      const body = await res.json();
      setSuggestions(body.values ?? []);
    }, 200);
    return () => clearTimeout(timeout);
  }, [value, field]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-stone-600">{label}</span>
      <input
        list={`${field}-suggestions`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-orange-200 p-2"
      />
      <datalist id={`${field}-suggestions`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
```

- [ ] **Step 2: Implement `ItemForm`**

```tsx
// components/ItemForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, ItemInput } from "../lib/types";
import { AutocompleteInput } from "./AutocompleteInput";

type ItemFormValues = {
  name: string;
  sku: string;
  quantity: string;
  reorder_at: string;
  location: string;
  category: string;
  notes: string;
  cost: string;
  price: string;
};

function toFormValues(item?: Item): ItemFormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    quantity: item ? String(item.quantity) : "0",
    reorder_at:
      item?.reorder_at !== null && item?.reorder_at !== undefined ? String(item.reorder_at) : "",
    location: item?.location ?? "",
    category: item?.category ?? "",
    notes: item?.notes ?? "",
    cost: item?.cost !== null && item?.cost !== undefined ? String(item.cost) : "",
    price: item?.price !== null && item?.price !== undefined ? String(item.price) : "",
  };
}

export function ItemForm({ item, prefillCode }: { item?: Item; prefillCode?: string }) {
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function update<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be 5MB or smaller.");
      setPhotoFile(null);
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: ItemInput = {
      name: values.name,
      sku: values.sku || null,
      quantity: Number(values.quantity) || 0,
      reorder_at: values.reorder_at === "" ? null : Number(values.reorder_at),
      location: values.location || null,
      category: values.category || null,
      notes: values.notes || null,
      cost: values.cost === "" ? null : Number(values.cost),
      price: values.price === "" ? null : Number(values.price),
      ...(prefillCode ? { qr_code: prefillCode } : {}),
    };

    const url = item ? `/api/items/${item.id}` : "/api/items";
    const method = item ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const body = await res.json();
    const savedItem = body.item as Item;

    if (photoFile) {
      const formData = new FormData();
      formData.append("photo", photoFile);
      await fetch(`/api/items/${savedItem.id}/photo`, { method: "POST", body: formData });
    }

    setSubmitting(false);
    router.push(`/items/${savedItem.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Name</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-orange-200 p-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">SKU</span>
        <input
          value={values.sku}
          onChange={(e) => update("sku", e.target.value)}
          className="rounded-lg border border-orange-200 p-2"
        />
      </label>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Quantity</span>
          <input
            type="number"
            value={values.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Reorder at</span>
          <input
            type="number"
            value={values.reorder_at}
            onChange={(e) => update("reorder_at", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
      </div>

      <AutocompleteInput
        label="Location"
        field="location"
        value={values.location}
        onChange={(v) => update("location", v)}
      />
      <AutocompleteInput
        label="Category"
        field="category"
        value={values.category}
        onChange={(v) => update("category", v)}
      />

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Cost</span>
          <input
            type="number"
            step="0.01"
            value={values.cost}
            onChange={(e) => update("cost", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Price</span>
          <input
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Notes</span>
        <textarea
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-lg border border-orange-200 p-2"
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Photo</span>
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
        {photoError && <span className="text-sm text-red-600">{photoError}</span>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : item ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implement the Add item page**

```tsx
// app/(app)/items/new/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { ItemForm } from "../../../../components/ItemForm";

export default function NewItemPage() {
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? undefined;
  return <ItemForm prefillCode={prefillCode} />;
}
```

- [ ] **Step 4: Implement the Edit item page**

```tsx
// app/(app)/items/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { getItem } from "../../../../../lib/items";
import { ItemForm } from "../../../../../components/ItemForm";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  if (!item) notFound();
  return <ItemForm item={item} />;
}
```

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, log in, go to `/items/new`, fill in name/quantity/cost/price/a photo, submit — expect a redirect to `/items/<id>` (a 404 until Task 14 adds that page; confirm instead by checking the Dashboard now lists the new item with correct quantity/location and a low-stock badge if `reorder_at >= quantity`). Edit the item via `/items/<id>/edit` and confirm changes persist on the Dashboard.

- [ ] **Step 6: Commit**

```bash
git add components/AutocompleteInput.tsx components/ItemForm.tsx "app/(app)/items/new" "app/(app)/items/[id]/edit"
git commit -m "Add item create/edit form with autocomplete and photo upload"
```

---

## Task 14: Item detail page, QrPrintLabel, and DeleteItemButton

**Files:**
- Create: `components/QrPrintLabel.tsx`
- Create: `components/DeleteItemButton.tsx`
- Create: `app/(app)/items/[id]/page.tsx`

**Interfaces:**
- Consumes: `getItem` (Task 8), `renderQrSvg` (Task 7), `computeMargin`/`isLowStock` (Task 6), `DELETE /api/items/:id` (Task 9).
- Produces: the `/items/:id` route used by Task 12's `ItemCard` links and Task 15's scan-found redirect.

- [ ] **Step 1: Implement `QrPrintLabel`**

```tsx
// components/QrPrintLabel.tsx
"use client";

export function QrPrintLabel({
  svg,
  name,
  sku,
}: {
  svg: string;
  name: string;
  sku: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 p-4 print:border-none">
      <div className="h-32 w-32" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-sm font-medium text-stone-800">{name}</p>
      {sku && <p className="text-xs text-stone-500">{sku}</p>}
      <button
        onClick={() => window.print()}
        className="mt-2 text-sm text-orange-500 underline print:hidden"
      >
        Print label
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `DeleteItemButton`**

```tsx
// components/DeleteItemButton.tsx
"use client";

import { useRouter } from "next/navigation";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <button
      onClick={handleDelete}
      className="flex-1 rounded-lg border border-red-300 p-3 text-center text-red-600"
    >
      Delete
    </button>
  );
}
```

- [ ] **Step 3: Implement the item detail page**

```tsx
// app/(app)/items/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem } from "../../../../lib/items";
import { renderQrSvg } from "../../../../lib/qr";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { QrPrintLabel } from "../../../../components/QrPrintLabel";
import { DeleteItemButton } from "../../../../components/DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  if (!item) notFound();

  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const qrSvg = await renderQrSvg(item.qr_code);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/items/${item.id}/photo`}
          alt={item.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-xl font-semibold text-stone-800">{item.name}</h1>
      {low && (
        <span className="w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          Low stock
        </span>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="SKU" value={item.sku ?? "—"} />
        <Field label="Quantity" value={String(item.quantity)} />
        <Field label="Location" value={item.location ?? "—"} />
        <Field label="Category" value={item.category ?? "—"} />
        <Field label="Cost" value={item.cost !== null ? `$${item.cost.toFixed(2)}` : "—"} />
        <Field label="Price" value={item.price !== null ? `$${item.price.toFixed(2)}` : "—"} />
        <Field label="Margin" value={margin !== null ? `$${margin.toFixed(2)}` : "—"} />
      </dl>

      {item.notes && <p className="text-sm text-stone-600">{item.notes}</p>}

      <QrPrintLabel svg={qrSvg} name={item.name} sku={item.sku} />

      <div className="flex gap-2">
        <Link
          href={`/items/${item.id}/edit`}
          className="flex-1 rounded-lg border border-orange-300 p-3 text-center"
        >
          Edit
        </Link>
        <DeleteItemButton itemId={item.id} />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Visit `/items/<id>` for the item created in Task 13. Confirm: photo shows (if uploaded), all fields display, margin computes correctly (`price - cost`), the QR code renders as a scannable-looking SVG, "Print label" opens the browser print dialog, "Edit" navigates to the edit page, and "Delete" (after confirming) removes the item and redirects to the Dashboard.

- [ ] **Step 5: Commit**

```bash
git add components/QrPrintLabel.tsx components/DeleteItemButton.tsx "app/(app)/items/[id]/page.tsx"
git commit -m "Add item detail page with printable QR label and delete"
```

---

## Task 15: QrScanner component and Scan page

**Files:**
- Create: `components/QrScanner.tsx`
- Create: `app/(app)/scan/page.tsx`

**Interfaces:**
- Consumes: `GET /api/items/lookup-by-code` (Task 9).
- Produces: the `/scan` route linked from Task 12's Dashboard floating button.

- [ ] **Step 1: Implement `QrScanner`**

```tsx
// components/QrScanner.tsx
"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QrScanner({
  onScan,
  onCameraError,
}: {
  onScan: (code: string) => void;
  onCameraError: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // decode-attempt errors fire continuously while scanning; ignore them
        }
      )
      .catch(() => {
        onCameraError();
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan, onCameraError]);

  return <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm" />;
}
```

- [ ] **Step 2: Implement the Scan page**

```tsx
// app/(app)/scan/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "../../../components/QrScanner";

export default function ScanPage() {
  const [manualCode, setManualCode] = useState("");
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const router = useRouter();

  const handleScan = useCallback(
    async (code: string) => {
      const res = await fetch(`/api/items/lookup-by-code?code=${encodeURIComponent(code)}`);
      const body = await res.json();
      if (body.item) {
        router.push(`/items/${body.item.id}`);
      } else {
        setNotFoundCode(code);
      }
    },
    [router]
  );

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Scan a code</h1>

      {!cameraFailed && (
        <QrScanner onScan={handleScan} onCameraError={() => setCameraFailed(true)} />
      )}

      {cameraFailed && (
        <p className="text-sm text-stone-600">
          Couldn&apos;t access the camera. Enter the code manually below.
        </p>
      )}

      {notFoundCode && (
        <div className="rounded-lg bg-orange-50 p-3 text-center">
          <p className="text-sm text-stone-600">No item found for code “{notFoundCode}”.</p>
          <button
            onClick={() => router.push(`/items/new?code=${encodeURIComponent(notFoundCode)}`)}
            className="mt-2 rounded-lg bg-orange-400 px-4 py-2 text-white"
          >
            Create new item with this code
          </button>
        </div>
      )}

      <details className="text-sm text-stone-500" open={cameraFailed}>
        <summary>Camera not working? Enter the code manually.</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan(manualCode);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-lg border border-orange-200 p-2"
            placeholder="e.g. bb_x7f2a9"
          />
          <button type="submit" className="rounded-lg bg-stone-800 px-3 py-2 text-white">
            Look up
          </button>
        </form>
      </details>
    </main>
  );
}
```

- [ ] **Step 3: Manually verify on a phone**

Deploy to Vercel first if testing on a real phone (camera APIs require HTTPS — `localhost` also works for this in most mobile browsers over a USB-connected dev tunnel, but the simplest path is: complete Task 18's deploy, then test on the live HTTPS URL). Confirm: the camera view opens and asks for permission; scanning an item's printed QR label (from Task 14) navigates to that item's detail page; scanning an unrecognized code shows "Create new item with this code" and pre-fills the code on the new-item form; denying camera permission falls back to the manual code entry field without a dead end.

- [ ] **Step 4: Commit**

```bash
git add components/QrScanner.tsx "app/(app)/scan"
git commit -m "Add QR/barcode scanning with manual-entry fallback"
```

---

## Task 16: Settings page

**Files:**
- Create: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/change-passcode`, `POST /api/auth/logout` (Task 5).
- Produces: the `/settings` route.

- [ ] **Step 1: Implement the Settings page**

```tsx
// app/(app)/settings/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleChangePasscode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/change-passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const body = await res.json();
    setMessage(res.ok ? "Passcode updated." : body.error ?? "Could not update passcode.");
    if (res.ok) {
      setCurrent("");
      setNext("");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>

      <form onSubmit={handleChangePasscode} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">Current passcode</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">New passcode</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        {message && <p className="text-sm text-stone-600">{message}</p>}
        <button type="submit" className="rounded-lg bg-orange-400 p-3 text-white">
          Update passcode
        </button>
      </form>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-stone-300 p-3 text-stone-600"
      >
        Log out
      </button>

      <div className="mt-6 flex justify-center">
        <Image src="/illustrations/random-deco.png" alt="" width={160} height={160} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Visit `/settings`. Try changing the passcode with the wrong current value — expect "Current passcode is incorrect". Change it correctly, log out, and confirm you can log back in with the new passcode.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/settings"
git commit -m "Add Settings page with passcode change and logout"
```

---

## Task 17: PWA manifest, icons, and install support

**Files:**
- Create: `public/manifest.json`
- Create: `scripts/generate-icons.js`
- Modify: `app/layout.tsx` (already references `/manifest.json` from Task 1 — no change needed, this task just makes the referenced files real)

**Interfaces:**
- Produces: `npm run generate-icons` (used by the `build` script wired in Task 1), `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/manifest.json`.

- [ ] **Step 1: Create the icon generation script**

```js
// scripts/generate-icons.js
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const sizes = [192, 512];
const source = path.join(__dirname, "..", "public", "illustrations", "logo.png");
const outDir = path.join(__dirname, "..", "public", "icons");

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of sizes) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 247, b: 237, alpha: 1 } })
      .toFile(path.join(outDir, `icon-${size}.png`));
  }
  console.log("Icons generated in public/icons/");
}

run();
```

- [ ] **Step 2: Create the manifest**

```json
{
  "name": "BoxBuddy",
  "short_name": "BoxBuddy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fff7ed",
  "theme_color": "#fb923c",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Run the icon generator and build**

Run: `npm run generate-icons`
Expected: `public/icons/icon-192.png` and `public/icons/icon-512.png` are created (they are gitignored per Task 1's `.gitignore` — they regenerate on every `npm run build`, which already runs this script first per the `package.json` wiring from Task 1 Step 2).

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manually verify PWA install**

Deploy to Vercel (Task 18) or run `npm run build && npm start` and access over HTTPS via a tunnel (e.g. `ngrok http 3000`). On a phone browser, open the site and confirm an "Add to Home Screen" / install prompt is available, and that installing it launches a standalone app window with the BoxBuddy icon.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-icons.js public/manifest.json
git commit -m "Add PWA manifest and icon generation"
```

---

## Task 18: Deployment

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: a documented, working production deployment reachable from any device.

- [ ] **Step 1: Push the repository to a git host**

```bash
cd "/Users/hanniamabellopezmontano/Library/Mobile Documents/com~apple~CloudDocs/boxbuddy"
git branch -m main
```

Create a new empty repository on GitHub (or your preferred host) yourself (external account action), then:

```bash
git remote add origin <your repo URL>
git push -u origin main
```

- [ ] **Step 2: Create the Vercel project**

Go to https://vercel.com, sign in (external account action, do this yourself), and import the git repository you just pushed. Vercel auto-detects Next.js — accept the defaults.

- [ ] **Step 3: Set environment variables in Vercel**

In the Vercel project's Settings → Environment Variables, add (values from your `.env.local`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_PASSCODE`
- `SESSION_SECRET`

Redeploy after saving (Vercel prompts for this automatically).

- [ ] **Step 4: Write the README**

```markdown
# BoxBuddy

Small-business inventory tracker with QR code generation/scanning, cost/price/margin
tracking, and low-stock alerts. See `docs/superpowers/specs/2026-08-04-inventory-tracker-design.md`
for the full design.

## Local development

1. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (Settings → API)
   - `APP_PASSCODE`: any starting passcode (changeable later from Settings)
   - `SESSION_SECRET`: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Run the schema in `supabase/schema.sql` against your Supabase project's SQL Editor.
3. `npm install`
4. `npm run dev`, then visit `http://localhost:3000`.

## Testing

`npm test` runs all unit tests. Tests that touch Supabase are skipped automatically unless
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the environment.

## Deployment

Deployed on Vercel, connected to this repository. Environment variables are set in the
Vercel project settings (see the four listed in `.env.example`). Every push to `main`
auto-deploys.
```

- [ ] **Step 5: Final end-to-end manual verification on the live URL**

On the deployed Vercel URL, from a phone:
- Log in with the passcode.
- Add an item with a photo, cost, price, and a reorder threshold below its quantity.
- Confirm the Dashboard shows it, with the low-stock badge if applicable, and the cost-value summary card reflects it.
- Open the item, print its QR label (or just view the SVG), then go to Scan and scan that same label — confirm it navigates back to the item.
- Scan an unrelated barcode (e.g. on any packaged product) — confirm "Create new item with this code" appears and pre-fills the form.
- Install the app to the home screen and relaunch it from there.
- Change the passcode from Settings, log out, log back in with the new passcode.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "Add README with setup and deployment instructions"
git push
```

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-04-inventory-tracker-design.md` maps to a task — architecture (Tasks 1–2, 17), data model (Task 2), screens (Tasks 5, 12–16), QR flow (Tasks 7–9, 14–15), error handling (rate limiting in Task 4, camera fallback in Task 15, photo size limit in Tasks 10/13, 401 redirects in Task 5's auth guard), testing (unit tests throughout, manual browser checks called out explicitly), deployment (Task 18).
- **Corrected during planning:** the design's "change passcode from Settings" requirement was inconsistent with a pure env-var passcode check, since Vercel env vars can't be edited at runtime from the app. Resolved by storing a salted passcode hash in the `app_settings` table (Task 2 schema, Task 4 `lib/passcode.ts`), seeded from `APP_PASSCODE` on first use — this is called out explicitly in the Global Constraints section so it isn't mistaken for scope creep.
- **Type consistency checked:** `Item`/`ItemInput` (Task 2) are used with the same field names and nullability throughout Tasks 8–16; `hasValidSession()` (Task 5) is the single auth check reused verbatim in every API route in Tasks 9–10; `computeMargin`/`isLowStock` (Task 6) signatures match their call sites in Tasks 12 and 14.
