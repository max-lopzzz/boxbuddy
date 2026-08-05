# Barcode SKU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace QR-code generation with barcode (Code128) generation, and replace manual SKU
text entry with scan-to-fill (or auto-generate if the item has no physical barcode).

**Architecture:** `lib/qr.ts`'s QR rendering is replaced by a new `lib/barcode.ts` using
`bwip-js` to render Code128 SVGs. The DB's `qr_code` and free-text `sku` columns merge into a
single `sku` column that always has a value. `ItemForm` drops its manual SKU text input in
favor of a scan button (reusing the renamed `BarcodeScanner`) and an explicit "no barcode"
button that defers to server-side auto-generation.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), `bwip-js`,
`html5-qrcode`, Vitest.

## Global Constraints

- The `sku` column is `not null` with `unique(owner_id, sku)` — every item always has a value,
  either scanned or auto-generated. (Spec: Data Model Changes)
- Auto-generated codes keep the existing `bb_xxxxxxxx` format (8 lowercase-alphanumeric chars,
  prefix `bb_`) — only the rendering format changes, not the generation algorithm. (Spec:
  Architecture)
- Auto-generated codes render as **Code128** barcodes via `bwip-js`. (Spec: Architecture)
- The SKU field in `ItemForm` has no manual text-entry path — only "Scan barcode" or "I don't
  have a barcode". (Spec: Screens & Components)
- No changes to authentication, RLS, or any non-`items`-related code. (Spec: Non-Goals)
- All new/changed UI copy is in English, matching the current app — the Spanish translation is
  a separate, not-yet-started spec. (Established convention; see
  `docs/superpowers/specs/2026-08-05-multi-user-accounts-design.md`)

---

### Task 1: Barcode rendering & SKU generation

**Files:**
- Create: `lib/barcode.ts`
- Create: `tests/lib/barcode.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces: `generateCandidateSku(): string`, `generateUniqueSku(skuExists: (sku: string) => Promise<boolean>): Promise<string>`, `renderBarcodeSvg(sku: string): string` — all exported from `lib/barcode.ts`.

This task is purely additive — `lib/qr.ts` is left in place and untouched for now, since other
files still import from it until Task 3. It gets deleted in Task 3 once every consumer has
migrated to `lib/barcode.ts`.

- [ ] **Step 1: Add `bwip-js`, remove the now-unneeded `qrcode` types stub for this new file (keep `qrcode` itself installed for now)**

Run:
```bash
npm install bwip-js@^4.11.2
```

Expected: `package.json` gains a `bwip-js` entry under `dependencies`. Do not remove `qrcode`
or `@types/qrcode` yet — `lib/qr.ts` still depends on them until Task 3.

- [ ] **Step 2: Write the failing test file**

Create `tests/lib/barcode.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { generateCandidateSku, generateUniqueSku, renderBarcodeSvg } from "../../lib/barcode";

describe("generateCandidateSku", () => {
  it("starts with bb_ and has 8 characters after the prefix", () => {
    const code = generateCandidateSku();
    expect(code.startsWith("bb_")).toBe(true);
    expect(code.length).toBe(3 + 8);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCandidateSku()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateUniqueSku", () => {
  it("returns the first candidate when it does not exist yet", async () => {
    const skuExists = vi.fn().mockResolvedValue(false);
    const code = await generateUniqueSku(skuExists);
    expect(skuExists).toHaveBeenCalledTimes(1);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("retries when a candidate already exists", async () => {
    const skuExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await generateUniqueSku(skuExists);
    expect(skuExists).toHaveBeenCalledTimes(2);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("throws after 10 failed attempts", async () => {
    const skuExists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueSku(skuExists)).rejects.toThrow(
      "Could not generate a unique SKU after 10 attempts"
    );
  });
});

describe("renderBarcodeSvg", () => {
  it("renders an SVG string", () => {
    const svg = renderBarcodeSvg("bb_abc12345");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/lib/barcode.test.ts`
Expected: FAIL — `Cannot find module '../../lib/barcode'` (the file doesn't exist yet).

- [ ] **Step 4: Implement `lib/barcode.ts`**

```ts
import crypto from "node:crypto";
import bwipjs from "bwip-js";

const CODE_PREFIX = "bb_";
const CODE_LENGTH = 8;
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"; // no ambiguous chars (0/1/o/l excluded)

export function generateCandidateSku(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueSku(
  skuExists: (sku: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCandidateSku();
    if (!(await skuExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique SKU after 10 attempts");
}

export function renderBarcodeSvg(sku: string): string {
  return bwipjs.toSVG({ bcid: "code128", text: sku });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/lib/barcode.test.ts`
Expected: PASS (4 test groups, all green).

- [ ] **Step 6: Commit**

```bash
git add lib/barcode.ts tests/lib/barcode.test.ts package.json package-lock.json
git commit -m "Add barcode rendering and SKU generation (lib/barcode.ts)"
```

---

### Task 2: Rename the barcode scanner component

**Files:**
- Create: `components/BarcodeScanner.tsx`
- Delete: `components/QrScanner.tsx`
- Modify: `app/(app)/scan/page.tsx`

**Interfaces:**
- Produces: `BarcodeScanner({ onScan, onCameraError }: { onScan: (code: string) => void; onCameraError: () => void })` — a React component, exported from `components/BarcodeScanner.tsx`.

`components/QrScanner.tsx` is only used by `app/(app)/scan/page.tsx` today, so it can be renamed
and deleted in the same task without breaking any other file. No behavior changes — this is a
naming fix only, since `html5-qrcode` already decodes Code128/EAN/UPC as well as QR.

- [ ] **Step 1: Create `components/BarcodeScanner.tsx`**

```tsx
// components/BarcodeScanner.tsx
"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "barcode-scanner-region";

export function BarcodeScanner({
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
    let cancelled = false;
    let started = false;

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
      .then(() => {
        started = true;
        if (cancelled) {
          // Unmounted while start() was still pending — stop it now that it's actually running.
          scanner.stop().catch(() => {});
        }
      })
      .catch(() => {
        onCameraError();
      });

    return () => {
      cancelled = true;
      if (started) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onScan, onCameraError]);

  return <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm" />;
}
```

- [ ] **Step 2: Delete the old component**

```bash
git rm components/QrScanner.tsx
```

- [ ] **Step 3: Update `app/(app)/scan/page.tsx`'s import and usage**

Modify `app/(app)/scan/page.tsx`:

```tsx
import { QrScanner } from "../../../components/QrScanner";
```
becomes:
```tsx
import { BarcodeScanner } from "../../../components/BarcodeScanner";
```

and:
```tsx
      {!cameraFailed && <QrScanner onScan={handleScan} onCameraError={handleCameraError} />}
```
becomes:
```tsx
      {!cameraFailed && <BarcodeScanner onScan={handleScan} onCameraError={handleCameraError} />}
```

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors (no remaining references to `QrScanner` or `components/QrScanner`).

- [ ] **Step 5: Commit**

```bash
git add components/BarcodeScanner.tsx "app/(app)/scan/page.tsx"
git commit -m "Rename QrScanner to BarcodeScanner"
```

---

### Task 3: Merge SKU/barcode into a single field (DB, types, items layer, item form, print label, item detail page)

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `README.md`
- Modify: `lib/types.ts`
- Modify: `lib/items.ts`
- Modify: `tests/lib/parse-item-input.test.ts`
- Modify: `tests/lib/items.integration.test.ts`
- Modify: `components/ItemForm.tsx`
- Create: `components/BarcodePrintLabel.tsx`
- Delete: `components/QrPrintLabel.tsx`
- Modify: `app/(app)/items/[id]/page.tsx`
- Delete: `lib/qr.ts`
- Delete: `tests/lib/qr.test.ts`
- Modify: `package.json` (remove `qrcode`, `@types/qrcode`)

**Interfaces:**
- Consumes: `generateUniqueSku`, `renderBarcodeSvg` from `lib/barcode.ts` (Task 1); `BarcodeScanner` from `components/BarcodeScanner.tsx` (Task 2).
- Produces: `Item.sku: string` (always present), `ItemInput.sku?: string` (optional — omit or send `null` to let the server auto-generate one) — both from `lib/types.ts`. `BarcodePrintLabel({ svg, name, sku }: { svg: string; name: string; sku: string })`.

This task is larger than the others on purpose: `Item`/`ItemInput` are shared types checked by
the whole project's `tsc`/`next build`, so the column rename and every one of its remaining
consumers (`lib/items.ts`, `ItemForm`, the item detail page, the print label) must land together
to keep the build green at every commit.

- [ ] **Step 1: Update the database schema (fresh-project target state)**

Modify `supabase/schema.sql` — change:

```sql
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  qr_code text not null,
  sku text,
  name text not null,
```
to:
```sql
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
```

and change:
```sql
  unique (owner_id, qr_code)
```
to:
```sql
  unique (owner_id, sku)
```

- [ ] **Step 2: Add the existing-project migration to `README.md`**

Modify `README.md`'s existing-project bullet (currently pointing only at the multi-user-accounts
migration) to also list this migration. Change:

```markdown
   - **Existing project** (e.g. one that predates per-user accounts): `schema.sql` only
     describes the fresh-project target state, not an upgrade path. Use the `alter table`
     migration in `docs/superpowers/plans/2026-08-05-multi-user-accounts.md` (Task 2, Step 2)
     instead — it adds `owner_id`, drops the old global `qr_code` uniqueness constraint in
     favor of a per-owner one, deletes any pre-existing test data that has no owner, and
     enables row level security on `items` (running `alter table items enable row level
     security;` is safe either way — it's a no-op if already enabled).
```
to:
```markdown
   - **Existing project** (e.g. one that predates per-user accounts): `schema.sql` only
     describes the fresh-project target state, not an upgrade path. Use the `alter table`
     migration in `docs/superpowers/plans/2026-08-05-multi-user-accounts.md` (Task 2, Step 2)
     instead — it adds `owner_id`, drops the old global `qr_code` uniqueness constraint in
     favor of a per-owner one, deletes any pre-existing test data that has no owner, and
     enables row level security on `items` (running `alter table items enable row level
     security;` is safe either way — it's a no-op if already enabled).
   - **Existing project that predates the barcode SKU merge:** also run this migration, which
     merges the old separate `qr_code` and `sku` columns into a single `sku` column (existing
     `qr_code` values are kept; the old free-text `sku` values are dropped):
     ```sql
     alter table items drop column sku;
     alter table items rename column qr_code to sku;
     ```
```

- [ ] **Step 3: Update `lib/types.ts`**

Replace the whole file:

```ts
export interface Item {
  id: string;
  sku: string;
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
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  sku?: string;
  photo_url?: string | null;
};
```

- [ ] **Step 4: Update the failing tests in `tests/lib/parse-item-input.test.ts` first**

Modify `tests/lib/parse-item-input.test.ts`. Remove `"sku"` from the generic optional-string-field
loop (it now has its own dedicated behavior, matching the old `qr_code` field). Change:

```ts
  describe("optional string fields (sku, location, category, notes)", () => {
    for (const field of ["sku", "location", "category", "notes"] as const) {
```
to:
```ts
  describe("optional string fields (location, category, notes)", () => {
    for (const field of ["location", "category", "notes"] as const) {
```

Then replace the `qr_code`-specific tests at the bottom of the file:

```ts
  it("passes through a provided qr_code", () => {
    const result = parseItemInput({ name: "Widget", qr_code: "bb_abc123" });
    expect(result.qr_code).toBe("bb_abc123");
  });

  it("throws when qr_code is an empty string", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: "" })).toThrow(InvalidItemInputError);
  });

  it("throws when qr_code is only whitespace", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: "   " })).toThrow(
      InvalidItemInputError
    );
  });

  it("throws when qr_code is not a string", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: 123 })).toThrow(InvalidItemInputError);
  });

  it("does not include qr_code when not provided", () => {
    const result = parseItemInput({ name: "Widget" });
    expect("qr_code" in result).toBe(false);
  });
```
with:
```ts
  it("passes through a provided sku", () => {
    const result = parseItemInput({ name: "Widget", sku: "bb_abc123" });
    expect(result.sku).toBe("bb_abc123");
  });

  it("throws when sku is an empty string", () => {
    expect(() => parseItemInput({ name: "Widget", sku: "" })).toThrow(InvalidItemInputError);
  });

  it("throws when sku is only whitespace", () => {
    expect(() => parseItemInput({ name: "Widget", sku: "   " })).toThrow(InvalidItemInputError);
  });

  it("throws when sku is not a string", () => {
    expect(() => parseItemInput({ name: "Widget", sku: 123 })).toThrow(InvalidItemInputError);
  });

  it("does not include sku when not provided", () => {
    const result = parseItemInput({ name: "Widget" });
    expect("sku" in result).toBe(false);
  });

  it("does not include sku when explicitly null", () => {
    const result = parseItemInput({ name: "Widget", sku: null });
    expect("sku" in result).toBe(false);
  });
```

Also update the "passes through a valid full input correctly" test's expectation — since `sku` is
now optional-omit-if-absent rather than always-present-and-nullable, an input that provides
`sku: "W-1"` should still produce `sku: "W-1"` in the result (unchanged behavior for this
specific case), so no change is needed there.

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/lib/parse-item-input.test.ts`
Expected: FAIL — `parseItemInput` still uses the old `sku`/`qr_code` logic, so e.g. "does not
include sku when explicitly null" fails (old code returns `sku: null`, not omitted).

- [ ] **Step 6: Update `lib/items.ts`**

Modify the import:
```ts
import { generateUniqueCode } from "./qr";
```
to:
```ts
import { generateUniqueSku } from "./barcode";
```

Replace the `sku`/`qr_code` handling in `parseItemInput`. Change:

```ts
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
```
to:
```ts
  const input: ItemInput = {
    name: b.name.trim(),
    quantity,
    reorder_at: parseOptionalNumber(b.reorder_at, "reorder_at"),
    location: parseOptionalString(b.location, "location"),
    category: parseOptionalString(b.category, "category"),
    notes: parseOptionalString(b.notes, "notes"),
    cost: parseOptionalNumber(b.cost, "cost"),
    price: parseOptionalNumber(b.price, "price"),
  };

  // sku is intentionally allowed through when explicitly provided (e.g. adopting a scanned
  // barcode), but must be a non-empty string if present — never silently coerced from junk.
  // undefined and null both mean "not provided" — the server generates one in that case.
  if (b.sku !== undefined && b.sku !== null) {
    if (typeof b.sku !== "string" || b.sku.trim() === "") {
      throw new InvalidItemInputError("sku must be a non-empty string if provided");
    }
    input.sku = b.sku;
  }

  return input;
```

Replace `lookupByCode`'s column reference. Change:
```ts
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
```
to:
```ts
export async function lookupByCode(ownerId: string, code: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("sku", code)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as Item | null;
}
```

Replace `createItem`. Change:
```ts
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
```
to:
```ts
export async function createItem(ownerId: string, input: ItemInput): Promise<Item> {
  const supabase = getSupabaseClient();
  const sku = input.sku ?? (await generateUniqueSku((code) => codeExists(ownerId, code)));
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, sku, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}
```

`listItems`'s search filter already references a column named `sku` (`sku.ilike."%${escaped}%"`)
— no change needed there, since that column name is unaffected by the rename (only `qr_code`
was renamed to `sku`; the search filter already matched the eventual merged name).

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/lib/parse-item-input.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 8: Update `tests/lib/items.integration.test.ts`**

Replace the whole file:

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

  it("creates an item with a generated sku, owned by the caller", async () => {
    const item = await createItem(ownerAId, {
      name: "Integration Test Widget",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: null,
      cost: 2.5,
      price: 9.99,
    });
    createdId = item.id;
    expect(item.sku.startsWith("bb_")).toBe(true);
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

  it("finds the item by sku for its owner only", async () => {
    const created = await getItem(ownerAId, createdId);
    const foundByOwner = await lookupByCode(ownerAId, created!.sku);
    expect(foundByOwner?.id).toBe(createdId);

    const foundByOtherOwner = await lookupByCode(ownerBId, created!.sku);
    expect(foundByOtherOwner).toBeNull();
  });

  it("allows a different owner to use the identical sku", async () => {
    const created = await getItem(ownerAId, createdId);
    const otherItem = await createItem(ownerBId, {
      name: "Owner B's Own Widget",
      quantity: 1,
      reorder_at: null,
      location: null,
      category: null,
      notes: null,
      cost: null,
      price: null,
      sku: created!.sku,
    });
    expect(otherItem.sku).toBe(created!.sku);
    await deleteItem(ownerBId, otherItem.id);
  });

  it("rejects the owner reusing their own sku on a second item", async () => {
    const created = await getItem(ownerAId, createdId);
    await expect(
      createItem(ownerAId, {
        name: "Duplicate Code Item",
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        sku: created!.sku,
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

- [ ] **Step 9: Run the integration test (only if Supabase env vars are set locally)**

Run: `npm test`
Expected: PASS if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set (this integration test suite
is skipped otherwise — that's expected and not a failure). Note: this requires the migration
from Step 2 to have already been run against whichever Supabase project the env vars point to.

- [ ] **Step 10: Create `components/BarcodePrintLabel.tsx`**

```tsx
// components/BarcodePrintLabel.tsx
"use client";

export function BarcodePrintLabel({
  svg,
  name,
  sku,
}: {
  svg: string;
  name: string;
  sku: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 p-4 print:border-none">
      <div className="h-20 w-full max-w-xs" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-sm font-medium text-stone-800">{name}</p>
      <p className="text-xs text-stone-500">{sku}</p>
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

- [ ] **Step 11: Delete `components/QrPrintLabel.tsx`**

```bash
git rm components/QrPrintLabel.tsx
```

- [ ] **Step 12: Update `app/(app)/items/[id]/page.tsx`**

Change the imports:
```tsx
import { renderQrSvg } from "../../../../lib/qr";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { QrPrintLabel } from "../../../../components/QrPrintLabel";
```
to:
```tsx
import { renderBarcodeSvg } from "../../../../lib/barcode";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { BarcodePrintLabel } from "../../../../components/BarcodePrintLabel";
```

Change:
```tsx
  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const qrSvg = await renderQrSvg(item.qr_code);
```
to:
```tsx
  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const barcodeSvg = renderBarcodeSvg(item.sku);
```

Change:
```tsx
        <Field label="SKU" value={item.sku ?? "—"} />
```
to:
```tsx
        <Field label="SKU" value={item.sku} />
```

Change:
```tsx
      <QrPrintLabel svg={qrSvg} name={item.name} sku={item.sku} />
```
to:
```tsx
      <BarcodePrintLabel svg={barcodeSvg} name={item.name} sku={item.sku} />
```

- [ ] **Step 13: Update `components/ItemForm.tsx`**

Replace the whole file:

```tsx
// components/ItemForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";

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

type SkuMode = "empty" | "scanning" | "filled" | "auto";

function toFormValues(item?: Item, prefillCode?: string): ItemFormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? prefillCode ?? "",
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
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item, prefillCode));
  const [skuMode, setSkuMode] = useState<SkuMode>(item?.sku || prefillCode ? "filled" : "empty");
  const [scanError, setScanError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
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

  function handleScan(code: string) {
    update("sku", code);
    setSkuMode("filled");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: ItemInput = {
      name: values.name,
      quantity: Number(values.quantity) || 0,
      reorder_at: values.reorder_at === "" ? null : Number(values.reorder_at),
      location: values.location || null,
      category: values.category || null,
      notes: values.notes || null,
      cost: values.cost === "" ? null : Number(values.cost),
      price: values.price === "" ? null : Number(values.price),
      ...(values.sku ? { sku: values.sku } : {}),
    };

    const url = savedItemState ? `/api/items/${savedItemState.id}` : "/api/items";
    const method = savedItemState ? "PATCH" : "POST";
    const res = await apiFetch(url, {
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
    setSavedItemState(savedItem);

    if (photoFile) {
      const formData = new FormData();
      formData.append("photo", photoFile);
      const photoRes = await apiFetch(`/api/items/${savedItem.id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!photoRes.ok) {
        const photoBody = await photoRes.json().catch(() => ({}));
        setError(photoBody.error ?? "The item saved, but the photo upload failed. You can try again below.");
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    router.refresh();
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

      <div className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">SKU</span>
        {skuMode === "scanning" ? (
          <div className="flex flex-col gap-2">
            <BarcodeScanner onScan={handleScan} onCameraError={() => setScanError(true)} />
            <button
              type="button"
              onClick={() => setSkuMode(values.sku ? "filled" : "empty")}
              className="text-sm text-stone-500 underline"
            >
              Cancel
            </button>
            {scanError && (
              <p className="text-sm text-red-600">
                Couldn&apos;t access the camera. Try &quot;I don&apos;t have a barcode&quot;
                instead.
              </p>
            )}
          </div>
        ) : values.sku ? (
          <div className="flex items-center justify-between rounded-lg border border-orange-200 p-2">
            <span className="text-stone-800">{values.sku}</span>
            <button
              type="button"
              onClick={() => {
                setScanError(false);
                setSkuMode("scanning");
              }}
              className="text-sm text-orange-500 underline"
            >
              Scan again
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-500">
              {skuMode === "auto"
                ? "A code will be generated automatically when you save."
                : "Scan this item's barcode, or generate one if it doesn't have one."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="flex-1 rounded-lg border border-orange-300 p-2 text-sm text-stone-700"
              >
                Scan barcode
              </button>
              <button
                type="button"
                onClick={() => setSkuMode("auto")}
                className="flex-1 rounded-lg border border-stone-300 p-2 text-sm text-stone-700"
              >
                I don&apos;t have a barcode
              </button>
            </div>
          </div>
        )}
      </div>

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
        {submitting ? "Saving…" : savedItemState ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
```

- [ ] **Step 14: Remove `lib/qr.ts`, its test, and the `qrcode` dependency**

```bash
git rm lib/qr.ts tests/lib/qr.test.ts
npm uninstall qrcode @types/qrcode
```

- [ ] **Step 15: Verify the build**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all non-integration tests pass (integration tests skip without
Supabase env vars, as before).

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "Merge qr_code and sku into a single sku column, rendered as a barcode"
```

---

### Task 4: Update the items API integration tests

**Files:**
- Modify: `tests/api/items.test.ts`

**Interfaces:**
- Consumes: `Item.sku`, `ItemInput.sku` from `lib/types.ts` (Task 3).

This only touches the HTTP-level API tests, which depend on `lib/items.ts`'s new `sku` field
(Task 3) but not on any UI component — independent of Tasks 2's/3's component changes.

- [ ] **Step 1: Replace the whole file**

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

  it("creates an item and returns it with a generated sku", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "API Test Widget",
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
    expect(typeof body.item.sku).toBe("string");
    expect(body.item.sku.startsWith("bb_")).toBe(true);
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

    const verifyRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.item.name).toBe("API Test Widget");
    expect(verifyBody.item.quantity).toBe(3);
  });

  it("a different account's DELETE attempt does not remove this item", async () => {
    const id = createdIds[0];
    // The DELETE route does not distinguish "not found" from "not owned" —
    // deleteItem() scopes its delete to `.eq("owner_id", ownerId)`, so a
    // cross-account delete simply matches zero rows and the route still
    // unconditionally responds 200 { ok: true }. The real assertion is that
    // the item survives, not the status code.
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "DELETE",
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);

    const verifyRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.item.id).toBe(id);
  });

  it("a different account cannot upload a photo to this item", async () => {
    const id = createdIds[0];
    const formData = new FormData();
    // The route's ownership check (getItem(userId, params.id)) runs before the
    // multipart body is parsed at all, so the file's byte content is irrelevant
    // here — the request should be rejected before any image processing.
    const imageBlob = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    formData.append("photo", imageBlob, "test.png");

    const res = await fetch(`${baseUrl}/api/items/${id}/photo`, {
      method: "POST",
      headers: { Cookie: otherSessionCookie },
      body: formData,
    });
    expect(res.status).toBe(404);
  });

  it("a different account cannot fetch this item's photo", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}/photo`, {
      headers: { Cookie: otherSessionCookie },
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

  it("returns 409 when creating a duplicate sku for the same account", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Duplicate Code Item",
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        sku: existing.item.sku,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("a different account CAN use the same sku without conflict", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: otherSessionCookie },
      body: JSON.stringify({
        name: "Other Account's Item",
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        sku: existing.item.sku,
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

  it("looks up the item by its sku", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(
      `${baseUrl}/api/items/lookup-by-code?code=${encodeURIComponent(existing.item.sku)}`,
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

- [ ] **Step 2: Run the test (only if Supabase env vars are set locally)**

Run: `npm test`
Expected: PASS if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are all set (skipped otherwise, which is expected).

- [ ] **Step 3: Commit**

```bash
git add tests/api/items.test.ts
git commit -m "Update items API tests for the merged sku field"
```

---

### Task 5: Final cleanup and manual verification

**Files:**
- None (verification only, plus any last references caught by the grep below).

- [ ] **Step 1: Grep for any remaining old references**

Run:
```bash
grep -rn "qr_code\|QrScanner\|QrPrintLabel\|generateUniqueCode\|generateCandidateCode\|renderQrSvg\|lib/qr\b" app lib components tests 2>/dev/null
```
Expected: no output. If anything is found, fix it before proceeding.

- [ ] **Step 2: Full build and test run**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: no type errors, a successful production build, and all non-integration tests passing.

- [ ] **Step 3: Manual verification**

With `npm run dev` running and a real Supabase project configured (migration from Task 3, Step 2
already applied):

1. Add a new item, click "Scan barcode", and scan a real product's barcode (or a Code128/EAN
   barcode image on another screen) — confirm the SKU field fills in with the scanned value and
   the item saves.
2. Add another item, click "I don't have a barcode" instead, and save without scanning — confirm
   the item saves with an auto-generated `bb_...` SKU.
3. Open that second item's detail page — confirm a barcode (not a QR code) renders under
   "Print label", and the SKU text below it matches the item's SKU.
4. Click "Print label", and — using either a real barcode scanner or the app's own "Scan a code"
   page — scan the printed barcode and confirm it resolves back to the same item.
5. Edit the first item and click "Scan again" — confirm scanning a different code updates the
   SKU and saves correctly.

- [ ] **Step 4: Commit (if Step 1 required any fixes)**

Only run this if Step 1 found something to fix:
```bash
git add -A
git commit -m "Clean up remaining QR references"
```
