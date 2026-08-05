# Multi-User Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BoxBuddy's single shared passcode with individual email/password accounts (via Supabase Auth), each with its own private inventory, plus self-serve sign-up and password reset.

**Architecture:** Supabase Auth handles sign-up/login/logout/password-reset directly from the browser via a public "anon" key (safe to expose). All inventory data access continues to go exclusively through our own Next.js API routes using the service-role key — the only change is every route now verifies the caller's identity via the Supabase Auth session and scopes every query to that user's `owner_id`.

**Tech Stack:** Next.js 14 (App Router), `@supabase/ssr` (new), `@supabase/supabase-js` (existing), Supabase Auth + Postgres.

## Global Constraints

- Sign-up is open — anyone can create an account, no invite/allowlist.
- Each account's inventory is completely private — no code path may return, update, or delete another account's items.
- No email confirmation step is required before an account can log in (configured off in the Supabase dashboard).
- The old passcode system is removed entirely — no admin backdoor, no fallback.
- `qr_code` uniqueness is per-owner (`unique(owner_id, qr_code)`), not global — two different accounts may legitimately use the same code (e.g. the same manufacturer barcode).
- The browser only talks to Supabase directly for **authentication** (via the public anon key). All inventory reads/writes still go exclusively through our own API routes using the service-role key, exactly as before.
- Existing test items in the live database are deleted as part of this migration (they predate accounts and aren't real inventory).
- Changing a password does not retroactively invalidate other already-open sessions elsewhere — a known, accepted limitation of Supabase Auth's default behavior.

---

## Task 1: Supabase Auth setup — client helpers, middleware, config

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Modify: `.env.example`
- Modify: `package.json` (add `@supabase/ssr`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `createSupabaseBrowserClient(): SupabaseClient` (lib/supabase/browser.ts) — used by every auth-facing page (Task 7, 8, 9). `createSupabaseServerClient(): SupabaseClient` (lib/supabase/server.ts) — used by `getCurrentUserId()` (Task 3).

- [ ] **Step 1: Install the dependency**

```bash
cd "/Users/hanniamabellopezmontano/Library/Mobile Documents/com~apple~CloudDocs/boxbuddy"
npm install @supabase/ssr
```

- [ ] **Step 2: Configure the Supabase dashboard (manual, external account action)**

In your Supabase project dashboard:
1. Go to **Authentication → Providers → Email** and turn **off** "Confirm email" (so sign-up logs a user in immediately, per the design's "no verification needed" decision).
2. Go to **Authentication → URL Configuration** and add these to **Redirect URLs** (needed for the password-reset email link to work):
   - `http://localhost:3000/reset-password`
   - `https://boxbuddy-nine.vercel.app/reset-password` (or your actual deployed domain, if different)
3. Go to **Settings → API → API Keys** and copy the **Publishable** (anon) key — you'll need it in Step 3 below. This is a different value from the **Secret** key already in `.env.local` — the anon/publishable key is safe to expose to the browser; never confuse the two.

- [ ] **Step 3: Update `.env.local` (not committed) with the two new variables**

Add to your existing `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<same value as your existing SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the Publishable/anon key from Step 2>
```

- [ ] **Step 4: Update `.env.example`**

```bash
# Supabase — server-side only, never expose to the browser
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Supabase — safe to expose to the browser (used by Supabase Auth client-side).
# NEXT_PUBLIC_SUPABASE_URL is the same value as SUPABASE_URL above, just re-declared
# under the NEXT_PUBLIC_ prefix Next.js requires for client-side exposure.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Create the browser client helper**

```ts
// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 6: Create the server client helper**

```ts
// lib/supabase/server.ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which can't set cookies — safe to
            // ignore since middleware.ts refreshes the session on every request.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 7: Create the middleware**

```ts
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session (rewriting cookies if the access token was renewed) so
  // Server Components downstream always see a current session.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

- [ ] **Step 8: Verify with a smoke check**

Run: `npx tsc --noEmit`
Expected: no new type errors (these three files are additive; nothing else references them yet, so this just confirms they compile).

Run: `npm run dev`, then in a browser or via `curl -i http://localhost:3000/login`
Expected: 200, no server error — the middleware runs on every request now, so this confirms it doesn't crash on a request with no session cookie at all. Stop the dev server when done.

- [ ] **Step 9: Commit**

```bash
git add lib/supabase/browser.ts lib/supabase/server.ts middleware.ts .env.example package.json package-lock.json
git commit -m "Add Supabase Auth client/server helpers and session-refresh middleware"
```

---

## Task 2: Database migration — per-user ownership

**Files:**
- Modify: `supabase/schema.sql` (rewritten to the new target schema)

**Interfaces:**
- Produces: `items.owner_id` column (uuid, references `auth.users(id)`), `unique(owner_id, qr_code)` constraint. Every later task's `lib/items.ts` change (Task 4) depends on this column existing.

- [ ] **Step 1: Rewrite `supabase/schema.sql` to the new target state**

This describes what a *fresh* project's schema should look like (used as documentation/for anyone spinning up a new Supabase project from scratch):

```sql
-- supabase/schema.sql
create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  qr_code text not null,
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
  updated_at timestamptz not null default now(),
  unique (owner_id, qr_code)
);

create index if not exists items_owner_id_idx on items (owner_id);
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

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Run the migration against the live Supabase project (manual, since it already has data and tables that need altering, not just creating)**

In the Supabase Dashboard SQL Editor, run this migration (this is different from Step 1's fresh-project schema — it alters the EXISTING live tables):

```sql
-- Delete existing items — they predate accounts and are development test data, not
-- real inventory (confirmed acceptable per the design's Non-Goals section).
delete from items;

-- Drop the old global uniqueness constraint on qr_code.
alter table items drop constraint if exists items_qr_code_key;

-- Add owner_id — nullable first since the column doesn't exist yet, then required
-- once every existing row is gone (from the delete above), so it's safe to make
-- NOT NULL for all future rows without a backfill.
alter table items add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table items alter column owner_id set not null;

-- Per-owner uniqueness instead of global.
alter table items add constraint items_owner_id_qr_code_key unique (owner_id, qr_code);

create index if not exists items_owner_id_idx on items (owner_id);

-- The old passcode system's tables are no longer used.
drop table if exists login_attempts;
drop table if exists app_settings;
```

Expected: no errors. The Table Editor should now show `items` with a new `owner_id` column and no `login_attempts`/`app_settings` tables, and the `items` table should be empty.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add per-owner item scoping to the database schema"
```

---

## Task 3: Replace the auth layer

**Files:**
- Create: `lib/auth.ts` (replacing its current contents entirely)
- Delete: `lib/session.ts`, `lib/passcode.ts`, `lib/rate-limit.ts`
- Delete: `tests/lib/session.test.ts`, `tests/lib/passcode.integration.test.ts`, `tests/lib/rate-limit.integration.test.ts`
- Delete: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/change-passcode/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient()` (Task 1).
- Produces: `getCurrentUserId(): Promise<string | null>` — replaces `hasValidSession()` everywhere it was used. Every later task that touched `hasValidSession()` now uses this instead.

- [ ] **Step 1: Delete the old auth files and their tests**

```bash
cd "/Users/hanniamabellopezmontano/Library/Mobile Documents/com~apple~CloudDocs/boxbuddy"
git rm lib/session.ts lib/passcode.ts lib/rate-limit.ts
git rm tests/lib/session.test.ts tests/lib/passcode.integration.test.ts tests/lib/rate-limit.integration.test.ts
git rm app/api/auth/login/route.ts app/api/auth/logout/route.ts app/api/auth/change-passcode/route.ts
rmdir app/api/auth 2>/dev/null || true
```

- [ ] **Step 2: Replace `lib/auth.ts`**

```ts
// lib/auth.ts
import "server-only";
import { createSupabaseServerClient } from "./supabase/server";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
```

- [ ] **Step 3: Confirm nothing else still references the deleted files**

Run: `grep -rn "hasValidSession\|lib/session\|lib/passcode\|lib/rate-limit" app/ lib/ components/ tests/ --include="*.ts" --include="*.tsx"`
Expected: no matches yet (Tasks 5, 6, 7, 9, 10 will re-add references to `getCurrentUserId` in their own files — this check just confirms the OLD names are gone from what currently exists; later tasks introduce the new call sites).

Run: `npx tsc --noEmit`
Expected: type errors WILL appear at this point — every file that imported `hasValidSession` (the API routes, the app layout) will fail to compile, since those files aren't updated until Tasks 5 and 6. This is expected and will be resolved by the end of this plan, not this task — do not attempt to fix those other files here. Confirm the errors are ONLY "cannot find module" / "hasValidSession is not exported" style errors in the files this plan's later tasks will touch (`app/api/items/**`, `app/api/items/[id]/**`, `app/(app)/layout.tsx`, `app/(app)/items/[id]/page.tsx`, `app/(app)/items/[id]/edit/page.tsx`) — not in any file outside that list.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Replace passcode-based auth with Supabase Auth session check"
```

---

## Task 4: Scope the items database layer to owners

**Files:**
- Modify: `lib/items.ts`
- Modify: `tests/lib/items.integration.test.ts`

**Interfaces:**
- Consumes: nothing new (still uses `getSupabaseClient()` from `lib/supabase.ts`, unchanged).
- Produces: every exported function in `lib/items.ts` now takes `ownerId: string` as its first parameter: `listItems(ownerId, search?)`, `getItem(ownerId, id)`, `lookupByCode(ownerId, code)`, `createItem(ownerId, input)`, `updateItem(ownerId, id, input)`, `deleteItem(ownerId, id)`, `autocompleteValues(ownerId, field, search)`. `parseItemInput(body)` is unchanged (owner_id is never a client-controllable field). Every route in Tasks 5 and 6 depends on these exact new signatures.

- [ ] **Step 1: Rewrite `lib/items.ts`**

```ts
// lib/items.ts
import { getSupabaseClient } from "./supabase";
import { generateUniqueCode } from "./qr";
import type { Item, ItemInput } from "./types";

function escapeForOrFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export class InvalidItemInputError extends Error {}

export function parseItemInput(body: unknown): ItemInput {
  if (typeof body !== "object" || body === null) {
    throw new InvalidItemInputError("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") {
    throw new InvalidItemInputError("name is required and must be a non-empty string");
  }

  const rawQuantity = b.quantity === undefined ? 0 : b.quantity;
  if (typeof rawQuantity !== "number" && typeof rawQuantity !== "string") {
    throw new InvalidItemInputError("quantity must be a number");
  }
  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity)) {
    throw new InvalidItemInputError("quantity must be a number");
  }

  const parseOptionalNumber = (value: unknown, field: string): number | null => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "number" && typeof value !== "string") {
      throw new InvalidItemInputError(`${field} must be a number or null`);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new InvalidItemInputError(`${field} must be a number or null`);
    return n;
  };

  const parseOptionalString = (value: unknown, field: string): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new InvalidItemInputError(`${field} must be a string or null`);
    return value;
  };

  const input: ItemInput = {
    name: b.name.trim(),
    sku: parseOptionalString(b.sku, "sku"),
    quantity,
    reorder_at: parseOptionalNumber(b.reorder_at, "reorder_at"),
    location: parseOptionalString(b.location, "location"),
    category: parseOptionalString(b.category, "category"),
    notes: parseOptionalString(b.notes, "notes"),
    cost: parseOptionalNumber(b.cost, "cost"),
    price: parseOptionalNumber(b.price, "price"),
  };

  // qr_code is intentionally allowed through when explicitly provided (e.g. adopting a scanned
  // barcode), but must be a non-empty string if present — never silently coerced from junk.
  if (b.qr_code !== undefined) {
    if (typeof b.qr_code !== "string" || b.qr_code.trim() === "") {
      throw new InvalidItemInputError("qr_code must be a non-empty string if provided");
    }
    input.qr_code = b.qr_code;
  }

  return input;
}

export async function listItems(ownerId: string, search?: string): Promise<Item[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("items")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (search) {
    const escaped = escapeForOrFilter(search);
    query = query.or(`name.ilike."%${escaped}%",sku.ilike."%${escaped}%"`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Item[];
}

export async function getItem(ownerId: string, id: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

export async function lookupByCode(ownerId: string, code: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("qr_code", code)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

async function codeExists(ownerId: string, code: string): Promise<boolean> {
  return (await lookupByCode(ownerId, code)) !== null;
}

export async function createItem(ownerId: string, input: ItemInput): Promise<Item> {
  const supabase = getSupabaseClient();
  const qr_code = input.qr_code ?? (await generateUniqueCode((code) => codeExists(ownerId, code)));
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, qr_code, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(
  ownerId: string,
  id: string,
  input: Partial<ItemInput>
): Promise<Item> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .update(input)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(ownerId: string, id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("items").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function autocompleteValues(
  ownerId: string,
  field: "location" | "category",
  search: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select(field)
    .eq("owner_id", ownerId)
    .ilike(field, `%${search}%`)
    .not(field, "is", null)
    .limit(50);
  if (error) throw error;
  const values = (data as Record<string, string>[]).map((row) => row[field]);
  return Array.from(new Set(values)).slice(0, 10);
}
```

Note: `updateItem`/`deleteItem` filtering by both `id` AND `owner_id` means an attempt to modify another user's item behaves identically to modifying a nonexistent item (0 rows matched — `updateItem`'s `.single()` throws `PGRST116`, `deleteItem` succeeds with 0 rows affected and no error) — this is intentional: it never reveals whether an item exists under a different owner.

- [ ] **Step 2: Rewrite the integration test for per-owner isolation**

```ts
// tests/lib/items.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
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
  let ownerAId: string;
  let ownerBId: string;
  let createdId: string;

  beforeAll(async () => {
    const supabase = getSupabaseClient();
    const emailSuffix = Date.now();
    const { data: userA, error: errorA } = await supabase.auth.admin.createUser({
      email: `test-owner-a-${emailSuffix}@example.com`,
      password: "test-password-not-real",
      email_confirm: true,
    });
    if (errorA || !userA.user) throw errorA ?? new Error("Failed to create test owner A");
    ownerAId = userA.user.id;

    const { data: userB, error: errorB } = await supabase.auth.admin.createUser({
      email: `test-owner-b-${emailSuffix}@example.com`,
      password: "test-password-not-real",
      email_confirm: true,
    });
    if (errorB || !userB.user) throw errorB ?? new Error("Failed to create test owner B");
    ownerBId = userB.user.id;
  });

  afterAll(async () => {
    const supabase = getSupabaseClient();
    // Deleting the auth users cascades to delete any items still owned by them.
    if (ownerAId) await supabase.auth.admin.deleteUser(ownerAId);
    if (ownerBId) await supabase.auth.admin.deleteUser(ownerBId);
  });

  it("creates an item with a generated qr_code, owned by the caller", async () => {
    const item = await createItem(ownerAId, {
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

  it("finds the item by id for its owner", async () => {
    const item = await getItem(ownerAId, createdId);
    expect(item?.name).toBe("Integration Test Widget");
  });

  it("returns null when a different owner requests the same item id", async () => {
    const item = await getItem(ownerBId, createdId);
    expect(item).toBeNull();
  });

  it("finds the item by qr_code for its owner only", async () => {
    const created = await getItem(ownerAId, createdId);
    const foundByOwner = await lookupByCode(ownerAId, created!.qr_code);
    expect(foundByOwner?.id).toBe(createdId);

    const foundByOtherOwner = await lookupByCode(ownerBId, created!.qr_code);
    expect(foundByOtherOwner).toBeNull();
  });

  it("allows a different owner to use the identical qr_code", async () => {
    const created = await getItem(ownerAId, createdId);
    const otherItem = await createItem(ownerBId, {
      name: "Owner B's Own Widget",
      sku: null,
      quantity: 1,
      reorder_at: null,
      location: null,
      category: null,
      notes: null,
      cost: null,
      price: null,
      qr_code: created!.qr_code,
    });
    expect(otherItem.qr_code).toBe(created!.qr_code);
    await deleteItem(ownerBId, otherItem.id);
  });

  it("rejects the owner reusing their own qr_code on a second item", async () => {
    const created = await getItem(ownerAId, createdId);
    await expect(
      createItem(ownerAId, {
        name: "Duplicate Code Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: created!.qr_code,
      })
    ).rejects.toThrow();
  });

  it("updates the item for its owner", async () => {
    const updated = await updateItem(ownerAId, createdId, { quantity: 5 } as any);
    expect(updated.quantity).toBe(5);
  });

  it("rejects a different owner's attempt to update the item", async () => {
    await expect(updateItem(ownerBId, createdId, { quantity: 99 } as any)).rejects.toThrow();
  });

  it("lists items scoped to the requesting owner", async () => {
    const ownerAItems = await listItems(ownerAId, "Integration Test Widget");
    expect(ownerAItems.some((i) => i.id === createdId)).toBe(true);

    const ownerBItems = await listItems(ownerBId, "Integration Test Widget");
    expect(ownerBItems.some((i) => i.id === createdId)).toBe(false);
  });

  it("a different owner's delete attempt has no effect", async () => {
    await deleteItem(ownerBId, createdId);
    const stillThere = await getItem(ownerAId, createdId);
    expect(stillThere).not.toBeNull();
  });

  it("deletes the item for its actual owner", async () => {
    await deleteItem(ownerAId, createdId);
    const gone = await getItem(ownerAId, createdId);
    expect(gone).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `set -a; source .env.local; set +a; npm test -- tests/lib/items.integration.test.ts`
Expected: PASS, all 10 tests (requires the `.env.local` credentials and Task 2's migration already applied to the live project).

- [ ] **Step 4: Commit**

```bash
git add lib/items.ts tests/lib/items.integration.test.ts
git commit -m "Scope the items database layer to the requesting owner"
```

---

## Task 5: Update the items API routes

**Files:**
- Modify: `app/api/items/route.ts`
- Modify: `app/api/items/[id]/route.ts`
- Modify: `app/api/items/[id]/photo/route.ts`
- Modify: `app/api/items/lookup-by-code/route.ts`
- Modify: `app/api/items/autocomplete/route.ts`

**Interfaces:**
- Consumes: `getCurrentUserId()` (Task 3), the new `lib/items.ts` signatures (Task 4).
- Produces: unchanged HTTP contract (same routes, methods, status codes) — only the identity-check mechanism and the ownership scoping change.

- [ ] **Step 1: Update `app/api/items/route.ts`**

```ts
// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import { listItems, createItem, parseItemInput, InvalidItemInputError } from "../../../lib/items";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const items = await listItems(userId, search);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let input;
  try {
    input = parseItemInput(await request.json());
  } catch (error: any) {
    if (error instanceof InvalidItemInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  try {
    const item = await createItem(userId, input);
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

- [ ] **Step 2: Update `app/api/items/[id]/route.ts`**

```ts
// app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import {
  getItem,
  updateItem,
  deleteItem,
  parseItemInput,
  InvalidItemInputError,
} from "../../../../lib/items";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(userId, params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let input;
  try {
    input = parseItemInput(await request.json());
  } catch (error: any) {
    if (error instanceof InvalidItemInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  try {
    const item = await updateItem(userId, params.id, input);
    return NextResponse.json({ item });
  } catch (error: any) {
    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "This code is already used by another item." },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteItem(userId, params.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update `app/api/items/[id]/photo/route.ts`**

```ts
// app/api/items/[id]/photo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../../lib/auth";
import { uploadPhoto, getSignedPhotoUrl } from "../../../../../lib/storage";
import { getItem, updateItem } from "../../../../../lib/items";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(userId, params.id);
  if (!item?.photo_url) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  const signedUrl = await getSignedPhotoUrl(item.photo_url);
  return NextResponse.redirect(signedUrl);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await getItem(userId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  await updateItem(userId, params.id, { photo_url: path });
  const signedUrl = await getSignedPhotoUrl(path);
  return NextResponse.json({ photo_url: path, signed_url: signedUrl });
}
```

Note the added ownership check at the top of `POST` (`getItem(userId, params.id)` before touching the upload) — this is new: previously any authenticated request could upload a photo to any item id since there was only one shared inventory; now it must confirm the item belongs to the caller before uploading anything to it.

- [ ] **Step 4: Update `app/api/items/lookup-by-code/route.ts`**

```ts
// app/api/items/lookup-by-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import { lookupByCode } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const item = await lookupByCode(userId, code);
  return NextResponse.json({ item });
}
```

- [ ] **Step 5: Update `app/api/items/autocomplete/route.ts`**

```ts
// app/api/items/autocomplete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import { autocompleteValues } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const field = request.nextUrl.searchParams.get("field");
  const search = request.nextUrl.searchParams.get("q") ?? "";
  if (field !== "location" && field !== "category") {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }
  const values = await autocompleteValues(userId, field, search);
  return NextResponse.json({ values });
}
```

- [ ] **Step 6: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: the errors from Task 3 Step 3 in these five files should now be gone. Any remaining errors should only be in `app/(app)/layout.tsx`, `app/(app)/items/[id]/page.tsx`, and `app/(app)/items/[id]/edit/page.tsx` (fixed in Task 6) — confirm no errors appear anywhere else.

- [ ] **Step 7: Commit**

```bash
git add app/api/items
git commit -m "Scope items API routes to the authenticated user"
```

---

## Task 6: Update server components that read items directly

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/items/[id]/page.tsx`
- Modify: `app/(app)/items/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUserId()` (Task 3), `getItem(ownerId, id)` (Task 4).

- [ ] **Step 1: Update `app/(app)/layout.tsx`**

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3">
        <Link href="/" className="font-semibold text-stone-800">
          BoxBuddy
        </Link>
        <Link href="/settings" className="text-sm text-stone-500 underline">
          Settings
        </Link>
      </header>
      {children}
    </>
  );
}
```

- [ ] **Step 2: Update `app/(app)/items/[id]/page.tsx`**

Only the top of the function changes — add the `getCurrentUserId()` call and pass `userId` into `getItem`; everything else in this file (margin/low-stock computation, QR rendering, JSX) is unchanged:

```tsx
// app/(app)/items/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { renderQrSvg } from "../../../../lib/qr";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { QrPrintLabel } from "../../../../components/QrPrintLabel";
import { DeleteItemButton } from "../../../../components/DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
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

- [ ] **Step 3: Update `app/(app)/items/[id]/edit/page.tsx`**

```tsx
// app/(app)/items/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "../../../../../lib/auth";
import { getItem } from "../../../../../lib/items";
import { ItemForm } from "../../../../../components/ItemForm";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
  if (!item) notFound();
  return <ItemForm item={item} />;
}
```

- [ ] **Step 4: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: clean — no errors anywhere now. This confirms every call site left over from deleting `hasValidSession()` in Task 3 has been updated.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/items/[id]/page.tsx" "app/(app)/items/[id]/edit/page.tsx"
git commit -m "Scope server-rendered item pages to the authenticated user"
```

---

## Task 7: Sign-up and login pages

**Files:**
- Create: `app/signup/page.tsx`
- Modify: `app/login/page.tsx` (replacing its current contents entirely)

**Interfaces:**
- Consumes: `createSupabaseBrowserClient()` (Task 1).

- [ ] **Step 1: Create `app/signup/page.tsx`**

```tsx
// app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Signing up..." : "Sign up"}
        </button>
        <Link href="/login" className="text-center text-sm text-stone-500 underline">
          Already have an account? Log in
        </Link>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/login/page.tsx`**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <div className="flex justify-between text-sm">
          <Link href="/signup" className="text-stone-500 underline">
            Sign up
          </Link>
          <Link href="/forgot-password" className="text-stone-500 underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`. In a real browser (this task needs actual cookie-setting JS behavior, not curl):
1. Visit `/signup`, create a real test account with a real email format (e.g. `you+test1@yourdomain.com`) and a password.
2. Expect an immediate redirect to `/` showing the Dashboard's empty state (no email confirmation step, per Task 1's dashboard config).
3. Go to `/settings` and click "Log out" — expect a redirect to `/login` (Settings itself isn't updated with the new account UI until Task 9, so seeing the OLD passcode-change form here briefly is expected and will be replaced next task; just use whatever logout mechanism currently exists, or navigate directly to clear the session by visiting `/login` after manually calling `supabase.auth.signOut()` in the browser devtools console if the old Settings page's logout button errors — note this in your report if so, since Task 9 fixes Settings).
4. Visit `/login` and log back in with the same test account's email/password — expect a redirect to `/`.
Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/signup/page.tsx app/login/page.tsx
git commit -m "Replace passcode login with email/password sign-up and login"
```

---

## Task 8: Forgot-password and reset-password pages

**Files:**
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient()` (Task 1).

- [ ] **Step 1: Create `app/forgot-password/page.tsx`**

```tsx
// app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Supabase intentionally never reveals whether the email has an account —
    // always show the same message regardless of the actual result.
    setMessage("If an account exists for that email, a reset link has been sent.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Image src="/illustrations/logo.png" alt="BoxBuddy" width={120} height={120} />
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        {message && <p className="text-center text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/reset-password/page.tsx`**

```tsx
// app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
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
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Set new password"}
        </button>
      </form>
    </main>
  );
}
```

Note: this page relies on Supabase's client library automatically detecting the password-recovery link's URL parameters and establishing a temporary "recovery" session when the page loads — no extra code is needed for that detection, it's handled internally by `createSupabaseBrowserClient()`'s underlying `supabase-js` client as soon as it's instantiated on this page.

- [ ] **Step 3: Verify manually**

Run: `npm run dev`. In a real browser:
1. Go to `/forgot-password`, enter the email of the test account created in Task 7, submit.
2. Check that email's inbox for a password-reset email from Supabase (this uses Supabase's built-in email sending — no extra setup should be needed, but if no email arrives within a couple minutes, check the Supabase Dashboard's Authentication → Logs for any delivery error and report it rather than guessing).
3. Click the link in the email — expect it to land on `/reset-password` (adjust the redirect URL in Task 1 Step 2 if it lands somewhere else or shows an error).
4. Set a new password, submit — expect a redirect to `/`.
5. Log out and log back in with the NEW password to confirm it actually took effect.
Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/forgot-password/page.tsx app/reset-password/page.tsx
git commit -m "Add forgot-password and reset-password pages"
```

---

## Task 9: Settings page — account section

**Files:**
- Modify: `app/(app)/settings/page.tsx` (replacing its current contents entirely)

**Interfaces:**
- Consumes: `createSupabaseBrowserClient()` (Task 1).

- [ ] **Step 1: Replace `app/(app)/settings/page.tsx`**

```tsx
// app/(app)/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    setMessage(error ? error.message : "Password updated.");
    if (!error) setNewPassword("");
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>

      {email && (
        <p className="text-sm text-stone-600">
          Signed in as <span className="font-medium">{email}</span>
        </p>
      )}

      <form onSubmit={handleChangePassword} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        {message && <p className="text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Update password"}
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

- [ ] **Step 2: Verify manually**

Run: `npm run dev`. Log in with the test account from Task 7. Visit `/settings`:
1. Confirm the page shows "Signed in as `<the test account's email>`".
2. Change the password to a new value, submit — expect "Password updated." and the field to clear.
3. Click "Log out" — expect redirect to `/login`.
4. Log back in with the NEW password (from step 2) — expect it to work, confirming the change actually took effect against Supabase Auth.
Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/settings/page.tsx"
git commit -m "Replace passcode change with account email display and password update"
```

---

## Task 10: Rewrite the automated API route tests for real accounts

**Files:**
- Modify: `tests/api/items.test.ts` (rewriting its auth setup; the individual route-behavior tests stay conceptually the same)

**Interfaces:**
- Consumes: `getSupabaseClient()` (`lib/supabase.ts`, for creating/deleting test auth users via the admin API), `@supabase/ssr`'s `createServerClient` (for obtaining a real session cookie without a browser).

- [ ] **Step 1: Rewrite the file's setup/teardown, keeping all the existing route-behavior test bodies**

```ts
// tests/api/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseClient } from "../../lib/supabase";

const hasEnv = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine a free port"));
      }
    });
    server.on("error", reject);
  });
}

async function waitForServer(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/login`);
      if (res.status < 500) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

// Creates a real Supabase Auth session for the given credentials and returns a
// `Cookie:` header string usable against our own Next.js server — without needing
// a real browser. Uses the same @supabase/ssr package the app itself uses, with a
// cookie adapter that just captures what would be set instead of writing anywhere.
async function loginAndGetCookieHeader(email: string, password: string): Promise<string> {
  const capturedCookies: string[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            capturedCookies.push(`${name}=${value}`);
          });
        },
      },
    }
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return capturedCookies.join("; ");
}

describe.skipIf(!hasEnv)("items API routes (integration)", () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;
  let sessionCookie: string;
  let otherSessionCookie: string;
  let testUserId: string;
  let otherTestUserId: string;
  const createdIds: string[] = [];

  const testEmail = `test-items-api-${Date.now()}@example.com`;
  const testPassword = "test-password-not-real-12345";
  const otherTestEmail = `test-items-api-other-${Date.now()}@example.com`;

  beforeAll(async () => {
    const admin = getSupabaseClient();

    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (userError || !user.user) throw userError ?? new Error("Failed to create test user");
    testUserId = user.user.id;

    const { data: otherUser, error: otherUserError } = await admin.auth.admin.createUser({
      email: otherTestEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (otherUserError || !otherUser.user) {
      throw otherUserError ?? new Error("Failed to create second test user");
    }
    otherTestUserId = otherUser.user.id;

    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: "pipe",
      detached: true,
    });
    await waitForServer(baseUrl, 60_000);

    sessionCookie = await loginAndGetCookieHeader(testEmail, testPassword);
    otherSessionCookie = await loginAndGetCookieHeader(otherTestEmail, testPassword);
  }, 90_000);

  afterAll(async () => {
    for (const id of createdIds) {
      await fetch(`${baseUrl}/api/items/${id}`, {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    if (serverProcess && serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
    }
    const admin = getSupabaseClient();
    if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    if (otherTestUserId) await admin.auth.admin.deleteUser(otherTestUserId).catch(() => {});
  });

  it("rejects unauthenticated requests to the items collection", async () => {
    const res = await fetch(`${baseUrl}/api/items`);
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated item creation", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Should Not Be Created" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects creating an item with no name", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ quantity: 5 }),
    });
    expect(res.status).toBe(400);
  });

  it("creates an item and returns it with a generated qr_code", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "API Test Widget",
        sku: "ATW-1",
        quantity: 10,
        reorder_at: 2,
        location: "Test Shelf",
        category: "Test Category",
        notes: "created by tests/api/items.test.ts",
        cost: 1.5,
        price: 4.99,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.name).toBe("API Test Widget");
    expect(typeof body.item.qr_code).toBe("string");
    expect(body.item.qr_code.startsWith("bb_")).toBe(true);
    createdIds.push(body.item.id);
  });

  it("fetches the created item by id", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(id);
  });

  it("a different account cannot see this item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(404);
  });

  it("a different account's item list does not include this item", async () => {
    const res = await fetch(`${baseUrl}/api/items?search=API%20Test%20Widget`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.some((i: any) => i.id === createdIds[0])).toBe(false);
  });

  it("updates the item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "API Test Widget",
        sku: "ATW-1",
        quantity: 3,
        reorder_at: 2,
        location: "Test Shelf",
        category: "Test Category",
        notes: null,
        cost: 1.5,
        price: 4.99,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.quantity).toBe(3);
  });

  it("a different account cannot update this item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherSessionCookie },
      body: JSON.stringify({
        name: "Hijacked",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating a nonexistent item", async () => {
    const res = await fetch(`${baseUrl}/api/items/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Nope",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when creating a duplicate qr_code for the same account", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Duplicate Code Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing.item.qr_code,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("a different account CAN use the same qr_code without conflict", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: otherSessionCookie },
      body: JSON.stringify({
        name: "Other Account's Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing.item.qr_code,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Clean up immediately since this item belongs to the second account, not
    // the one `afterAll`'s createdIds loop cleans up.
    await fetch(`${baseUrl}/api/items/${body.item.id}`, {
      method: "DELETE",
      headers: { Cookie: otherSessionCookie },
    });
  });

  it("looks up the item by its qr_code", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(
      `${baseUrl}/api/items/lookup-by-code?code=${encodeURIComponent(existing.item.qr_code)}`,
      { headers: { Cookie: sessionCookie } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(createdIds[0]);
  });

  it("returns null for an unrecognized code", async () => {
    const res = await fetch(`${baseUrl}/api/items/lookup-by-code?code=bb_doesnotexist12`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toBeNull();
  });

  it("returns matching autocomplete suggestions for location", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=location&q=Test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values).toContain("Test Shelf");
  });

  it("a different account's autocomplete does not see this location", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=location&q=Test`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values).not.toContain("Test Shelf");
  });

  it("rejects an invalid autocomplete field", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=bogus&q=Test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(400);
  });

  it("deletes the item and it is then not found", async () => {
    const id = createdIds[0];
    const deleteRes = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
    expect(deleteRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status).toBe(404);

    createdIds.length = 0;
  }, 20_000);
});
```

If `loginAndGetCookieHeader` doesn't produce a cookie header the spawned Next server actually accepts (e.g. because of a subtle mismatch you discover once you run this for real), stop and report the exact behavior you observed — do not guess at a workaround; this mechanism is the crux of the whole test file and needs to be verified, not assumed.

- [ ] **Step 2: Run it**

Run: `set -a; source .env.local; set +a; npm test -- tests/api/items.test.ts`
Expected: all tests pass, including the four new cross-account isolation tests. This will take a bit longer than before (creating two real auth users plus the usual server boot).

- [ ] **Step 3: Run the full suite**

Run: `set -a; source .env.local; set +a; npm test`
Expected: all tests pass (this also implicitly confirms Task 4's rewritten `tests/lib/items.integration.test.ts` still works correctly alongside this file, given `fileParallelism: false` already prevents any cross-file interference).

- [ ] **Step 4: Commit**

```bash
git add tests/api/items.test.ts
git commit -m "Rewrite API route tests for real Supabase Auth accounts and cross-account isolation"
```

---

## Task 11: Final cleanup, docs, and full manual verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: an accurate setup guide for the new account-based system; a fully verified end-to-end account flow.

- [ ] **Step 1: Update `README.md`**

Read the current `README.md` and rewrite its "Local development" and "Deployment" sections to remove any mention of `APP_PASSCODE`/`SESSION_SECRET`/the passcode system, and instead describe:
- The four env vars now needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (matching the final `.env.example` from Task 1).
- Running `supabase/schema.sql` in the SQL Editor for a fresh project (mention that an *existing* project needs the migration from Task 2 Step 2 instead, since that schema file only describes a fresh-project target state).
- Turning off "Confirm email" and configuring redirect URLs in the Supabase dashboard (Task 1 Step 2), since a fresh setup needs this too.
- Sign-up is open (anyone can create an account), and each account has a private inventory.

- [ ] **Step 2: Full manual verification with a real browser**

Run: `npm run dev`. Using a real browser (private/incognito window recommended, to start with no existing session):
1. Sign up as a brand-new test account (`/signup`). Confirm immediate access to the Dashboard (empty state).
2. Add an item with a photo, cost, price, and a reorder threshold below its quantity. Confirm it shows on the Dashboard with a low-stock badge.
3. Open the item, confirm the printable QR label renders. Go to `/scan` and scan it (or use the manual-entry fallback with its `qr_code`, visible on the item detail page) — confirm it navigates back to the same item.
4. Log out from Settings.
5. Sign up as a SECOND brand-new test account, in the same browser or a fresh incognito window. Confirm its Dashboard is empty — NOT showing the first account's item.
6. Log out, log back in as the FIRST account — confirm its item is still there.
7. Test "Forgot password" end-to-end for the first account (per Task 8's manual check, if not already fully verified there).
8. Confirm the PWA still installs correctly (Add to Home Screen) and the offline app-shell behavior from the earlier PWA work is unaffected by these auth changes.

Report the outcome of every step explicitly — this is the final gate before this feature is considered done.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Update README for Supabase Auth-based multi-user setup"
```

---

## Self-Review Notes

- **Spec coverage:** open sign-up (Task 7), private per-user inventories (Tasks 4-6), no email verification (Task 1's dashboard config), self-serve password reset (Task 8), old passcode fully removed (Task 3), per-owner `qr_code` uniqueness (Task 2, Task 4), browser-only-talks-to-Supabase-for-auth (Tasks 1, 7, 8, 9 use the anon-key browser client only for auth calls; Tasks 4-6 keep all data access server-side with the service-role key) — every design requirement maps to a task.
- **Type consistency checked:** every `lib/items.ts` function's new `ownerId` first parameter (Task 4) is threaded consistently into every call site across Tasks 5 and 6, using the exact same parameter order and the `userId` variable name returned by `getCurrentUserId()` (Task 3).
- **Known novel-integration risk flagged:** Task 10's `loginAndGetCookieHeader` helper is the one piece of this plan without a long track record in this codebase (unlike the rest, which follows extremely well-trodden Next.js/Supabase CRUD patterns already proven in earlier work) — its step explicitly tells the implementer to stop and report rather than guess if it doesn't work as written, instead of silently papering over a mismatch.
