# RevenueCat Subscriptions (BoxBuddy Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-tier "BoxBuddy Pro" subscription (Monthly/Yearly/Lifetime) via RevenueCat's Web SDK, enforced server-side, with an item-count limit, gated label printing, RevenueCat's hosted paywall, and a Settings subscription section.

**Architecture:** Client-side, a thin wrapper (`lib/revenuecat/client.ts`) configures `Purchases` once per Supabase user ID and calls RevenueCat's hosted, full-screen `presentPaywall()` — no custom paywall UI. Server-side, `lib/subscription.ts` resolves the true tier by calling RevenueCat's REST API directly (no webhooks, no DB cache), failing closed to the free tier on any error. Two enforcement points — item creation (`POST /api/items`) and label printing (the item detail page) — both call this one server module, so tier rules exist in exactly one place.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind, Supabase, `@revenuecat/purchases-js` v1.51.2 (already installed), Vitest (node environment, no jsdom/React Testing Library).

Reference spec: `docs/superpowers/specs/2026-08-07-revenuecat-subscriptions-design.md`

## Global Constraints

- Entitlement identifier is exactly `"BoxBuddy Pro"` (space and capitals, confirmed as the literal RevenueCat dashboard identifier) — used verbatim in `lib/subscription.ts`.
- Product identifiers are exactly `monthly`, `yearly`, `lifetime`.
- Tier rules (single source of truth: `TIER_RULES` in `lib/subscription.ts`): free = 50 items / no printing; monthly = 500 items / printing; yearly = 500 items / printing; lifetime = unlimited items / printing.
- Server-side tier resolution calls `GET https://api.revenuecat.com/v1/subscribers/{appUserId}` with header `Authorization: Bearer <REVENUECAT_SECRET_API_KEY>`, and **fails closed to the free tier** on any network error, non-2xx response, or unexpected JSON shape — never fails open.
- No webhooks and no database caching of subscription state — every check calls RevenueCat's REST API live.
- Env vars: `NEXT_PUBLIC_REVENUECAT_API_KEY` (client-safe publishable key) and `REVENUECAT_SECRET_API_KEY` (server-only). Both added to `.env.example` as empty placeholders; real values go in `.env.local`, never committed.
- RevenueCat's Customer Center is not used (confirmed unsupported on the Web SDK) — a "Manage subscription" link uses the subscriber's `management_url` instead.
- Existing items are never hidden, archived, or deleted when a user is over their (possibly downgraded) limit — only creating additional items is blocked.
- `@revenuecat/purchases-js` (`^1.51.2`) is already an installed dependency — no `npm install` step in this plan.
- Every new user-facing string is added to both `lib/i18n/en.ts` and `lib/i18n/es.ts`. `tests/lib/i18n/dictionaries.test.ts` (pre-existing) asserts the two dictionaries have identical key sets and no empty values — it must keep passing.
- Test runner is `npm test` (Vitest, `environment: "node"` per `vitest.config.ts` — no DOM available). Only files with pure/testable logic (`lib/*.ts`) get automated unit tests; UI/page wiring tasks are verified via `npx tsc --noEmit` plus manual browser checks, matching this repo's existing pattern (no component-level tests exist anywhere in this codebase).
- Server-side modules that must never be imported into client bundles are marked with `import "server-only";` at the top, matching the existing `lib/auth.ts` / `lib/supabase.ts` pattern.

---

### Task 1: Server-side subscription tier resolution

**Files:**
- Create: `lib/subscription.ts`
- Test: `tests/lib/subscription.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the foundation).
- Produces (used by Tasks 3, 4, 5):
  - `export type SubscriptionTier = "free" | "monthly" | "yearly" | "lifetime";`
  - `export type SubscriptionStatus = { tier: SubscriptionTier; itemLimit: number | null; canPrintLabels: boolean; managementURL: string | null };`
  - `export const FREE_TIER_STATUS: SubscriptionStatus`
  - `export function parseSubscriberResponse(json: unknown): SubscriptionStatus`
  - `export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/subscription.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  parseSubscriberResponse,
  getSubscriptionStatus,
  FREE_TIER_STATUS,
} from "../../lib/subscription";

function subscriberJson(entitlement?: {
  expires_date?: string | null;
  product_identifier?: string;
}) {
  return {
    subscriber: {
      management_url: "https://app.revenuecat.com/manage/abc123",
      entitlements: entitlement
        ? {
            "BoxBuddy Pro": {
              expires_date: entitlement.expires_date ?? null,
              product_identifier: entitlement.product_identifier ?? "monthly",
              purchase_date: "2026-01-01T00:00:00Z",
            },
          }
        : {},
    },
  };
}

describe("parseSubscriberResponse", () => {
  it("returns lifetime tier for a non-expiring lifetime entitlement", () => {
    const result = parseSubscriberResponse(
      subscriberJson({ expires_date: null, product_identifier: "lifetime" })
    );
    expect(result).toEqual({
      tier: "lifetime",
      itemLimit: null,
      canPrintLabels: true,
      managementURL: "https://app.revenuecat.com/manage/abc123",
    });
  });

  it("returns monthly tier for an active, not-yet-expired monthly entitlement", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const result = parseSubscriberResponse(
      subscriberJson({ expires_date: future, product_identifier: "monthly" })
    );
    expect(result.tier).toBe("monthly");
    expect(result.itemLimit).toBe(500);
    expect(result.canPrintLabels).toBe(true);
  });

  it("returns yearly tier for an active yearly entitlement", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const result = parseSubscriberResponse(
      subscriberJson({ expires_date: future, product_identifier: "yearly" })
    );
    expect(result.tier).toBe("yearly");
    expect(result.itemLimit).toBe(500);
    expect(result.canPrintLabels).toBe(true);
  });

  it("falls back to free when the entitlement is expired", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const result = parseSubscriberResponse(
      subscriberJson({ expires_date: past, product_identifier: "monthly" })
    );
    expect(result.tier).toBe("free");
    expect(result.itemLimit).toBe(50);
    expect(result.canPrintLabels).toBe(false);
  });

  it("falls back to free when there is no 'BoxBuddy Pro' entitlement at all", () => {
    const result = parseSubscriberResponse(subscriberJson());
    expect(result.tier).toBe("free");
    expect(result.itemLimit).toBe(50);
    expect(result.canPrintLabels).toBe(false);
  });

  it("falls back to free for an unrecognized product_identifier", () => {
    const result = parseSubscriberResponse(
      subscriberJson({ expires_date: null, product_identifier: "some_other_product" })
    );
    expect(result.tier).toBe("free");
  });

  it("still surfaces managementURL on an otherwise-free result", () => {
    const result = parseSubscriberResponse(subscriberJson());
    expect(result.managementURL).toBe("https://app.revenuecat.com/manage/abc123");
  });

  it("returns FREE_TIER_STATUS with null managementURL for malformed top-level input", () => {
    expect(parseSubscriberResponse(null)).toEqual(FREE_TIER_STATUS);
    expect(parseSubscriberResponse("not an object")).toEqual(FREE_TIER_STATUS);
    expect(parseSubscriberResponse({})).toEqual(FREE_TIER_STATUS);
    expect(parseSubscriberResponse({ subscriber: null })).toEqual(FREE_TIER_STATUS);
  });
});

describe("getSubscriptionStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns FREE_TIER_STATUS without fetching when the secret key is not set", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await getSubscriptionStatus("user-123");
    expect(result).toEqual(FREE_TIER_STATUS);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns FREE_TIER_STATUS when the API responds non-2xx", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    const result = await getSubscriptionStatus("user-123");
    expect(result).toEqual(FREE_TIER_STATUS);
  });

  it("returns FREE_TIER_STATUS when fetch throws", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );
    const result = await getSubscriptionStatus("user-123");
    expect(result).toEqual(FREE_TIER_STATUS);
  });

  it("parses a successful response and calls the correct URL/headers", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test_123");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        subscriberJson({ expires_date: null, product_identifier: "lifetime" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSubscriptionStatus("user-abc");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.revenuecat.com/v1/subscribers/user-abc",
      { headers: { Authorization: "Bearer sk_test_123" } }
    );
    expect(result.tier).toBe("lifetime");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- subscription`
Expected: FAIL — `lib/subscription.ts` does not exist yet (module resolution error).

- [ ] **Step 3: Write the implementation**

Create `lib/subscription.ts`:

```ts
// lib/subscription.ts
import "server-only";

export type SubscriptionTier = "free" | "monthly" | "yearly" | "lifetime";

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  itemLimit: number | null;
  canPrintLabels: boolean;
  managementURL: string | null;
};

const ENTITLEMENT_ID = "BoxBuddy Pro";

const TIER_RULES: Record<SubscriptionTier, { itemLimit: number | null; canPrintLabels: boolean }> = {
  free: { itemLimit: 50, canPrintLabels: false },
  monthly: { itemLimit: 500, canPrintLabels: true },
  yearly: { itemLimit: 500, canPrintLabels: true },
  lifetime: { itemLimit: null, canPrintLabels: true },
};

export const FREE_TIER_STATUS: SubscriptionStatus = {
  tier: "free",
  itemLimit: TIER_RULES.free.itemLimit,
  canPrintLabels: TIER_RULES.free.canPrintLabels,
  managementURL: null,
};

function isKnownProduct(value: unknown): value is "monthly" | "yearly" | "lifetime" {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

export function parseSubscriberResponse(json: unknown): SubscriptionStatus {
  if (typeof json !== "object" || json === null) return FREE_TIER_STATUS;

  const subscriber = (json as Record<string, unknown>).subscriber;
  if (typeof subscriber !== "object" || subscriber === null) return FREE_TIER_STATUS;

  const s = subscriber as Record<string, unknown>;
  const managementURL = typeof s.management_url === "string" ? s.management_url : null;

  const entitlements = s.entitlements;
  if (typeof entitlements !== "object" || entitlements === null) {
    return { ...FREE_TIER_STATUS, managementURL };
  }

  const entry = (entitlements as Record<string, unknown>)[ENTITLEMENT_ID];
  if (typeof entry !== "object" || entry === null) {
    return { ...FREE_TIER_STATUS, managementURL };
  }

  const e = entry as Record<string, unknown>;
  const expiresDate = e.expires_date;
  const isExpired =
    typeof expiresDate === "string" && new Date(expiresDate).getTime() <= Date.now();
  if (isExpired) {
    return { ...FREE_TIER_STATUS, managementURL };
  }

  const productIdentifier = e.product_identifier;
  const tier: SubscriptionTier = isKnownProduct(productIdentifier) ? productIdentifier : "free";
  const rules = TIER_RULES[tier];
  return { tier, itemLimit: rules.itemLimit, canPrintLabels: rules.canPrintLabels, managementURL };
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secretKey) {
    console.error("REVENUECAT_SECRET_API_KEY is not set; defaulting to free tier");
    return FREE_TIER_STATUS;
  }
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) {
      console.error(`RevenueCat subscriber lookup failed with status ${res.status}`);
      return FREE_TIER_STATUS;
    }
    const json = await res.json();
    return parseSubscriberResponse(json);
  } catch (error) {
    console.error("RevenueCat subscriber lookup threw", error);
    return FREE_TIER_STATUS;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- subscription`
Expected: PASS — all tests in `tests/lib/subscription.test.ts` green.

- [ ] **Step 5: Add the env var placeholder**

In `.env.example`, append at the end of the file:

```
# RevenueCat — server-side only, never expose to the browser. Used by lib/subscription.ts
# to authoritatively resolve a user's subscription tier via RevenueCat's REST API.
REVENUECAT_SECRET_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add lib/subscription.ts tests/lib/subscription.test.ts .env.example
git commit -m "Add server-side RevenueCat subscription tier resolution"
```

---

### Task 2: Add i18n translation keys

**Files:**
- Modify: `lib/i18n/en.ts:45` (after `"settings.languageSpanish"`)
- Modify: `lib/i18n/es.ts:47` (after `"settings.languageSpanish"`)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 5, 7, 8): the following `TranslationKey`s become available to `t()`:
  `subscription.sectionTitle`, `subscription.tierFree`, `subscription.tierMonthly`,
  `subscription.tierYearly`, `subscription.tierLifetime`, `subscription.unlimitedItems`,
  `subscription.upgradeButton`, `subscription.manageSubscriptionLink`,
  `subscription.loadFailed`, `subscription.loading`, `subscription.paywallError`,
  `subscription.itemLimitReachedMessage`, `subscription.printLabelsUpgradePrompt`.
  (`dashboard.itemsLabel`, already existing, is reused for the "N / limit items" display.)

- [ ] **Step 1: Add the English keys**

In `lib/i18n/en.ts`, find this line:

```ts
  "settings.languageSpanish": "Español",
```

Replace it with:

```ts
  "settings.languageSpanish": "Español",

  "subscription.sectionTitle": "Subscription",
  "subscription.tierFree": "Free",
  "subscription.tierMonthly": "Monthly",
  "subscription.tierYearly": "Yearly",
  "subscription.tierLifetime": "Lifetime",
  "subscription.unlimitedItems": "Unlimited items",
  "subscription.upgradeButton": "Upgrade",
  "subscription.manageSubscriptionLink": "Manage subscription",
  "subscription.loadFailed": "Couldn't load your subscription info. Try again.",
  "subscription.loading": "Loading your subscription…",
  "subscription.paywallError": "Something went wrong showing the upgrade options. Please try again.",
  "subscription.itemLimitReachedMessage":
    "You've reached your plan's item limit. Upgrade to add more items.",
  "subscription.printLabelsUpgradePrompt": "Upgrade to print barcode labels.",
```

- [ ] **Step 2: Add the matching Spanish keys**

In `lib/i18n/es.ts`, find this line:

```ts
  "settings.languageSpanish": "Español",
```

Replace it with:

```ts
  "settings.languageSpanish": "Español",

  "subscription.sectionTitle": "Suscripción",
  "subscription.tierFree": "Gratis",
  "subscription.tierMonthly": "Mensual",
  "subscription.tierYearly": "Anual",
  "subscription.tierLifetime": "De por vida",
  "subscription.unlimitedItems": "Artículos ilimitados",
  "subscription.upgradeButton": "Mejorar plan",
  "subscription.manageSubscriptionLink": "Administrar suscripción",
  "subscription.loadFailed": "No se pudo cargar tu información de suscripción. Intenta de nuevo.",
  "subscription.loading": "Cargando tu suscripción…",
  "subscription.paywallError":
    "Algo salió mal al mostrar las opciones de mejora de plan. Intenta de nuevo.",
  "subscription.itemLimitReachedMessage":
    "Alcanzaste el límite de artículos de tu plan. Mejora tu plan para agregar más.",
  "subscription.printLabelsUpgradePrompt": "Mejora tu plan para imprimir etiquetas de código de barras.",
```

- [ ] **Step 3: Run the dictionary parity test**

Run: `npm test -- dictionaries`
Expected: PASS — `tests/lib/i18n/dictionaries.test.ts` confirms `en.ts` and `es.ts` still have identical key sets and no empty values.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/en.ts lib/i18n/es.ts
git commit -m "Add translation keys for BoxBuddy Pro subscriptions"
```

---

### Task 3: Shared API test helpers, item count, and `GET /api/subscription`

**Files:**
- Create: `tests/helpers/api-server.ts`
- Modify: `tests/api/items.test.ts` (use the shared helpers instead of its own inline copies — no behavior change)
- Modify: `lib/items.ts` (add `getItemCount`)
- Create: `app/api/subscription/route.ts`
- Create: `tests/api/subscription.test.ts`

**Interfaces:**
- Consumes: `getCurrentUserId` (`lib/auth.ts`); `getSubscriptionStatus` (`lib/subscription.ts`, Task 1).
- Produces (used by Task 4, Task 8):
  - `export async function getItemCount(ownerId: string): Promise<number>` in `lib/items.ts`.
  - `GET /api/subscription` — for a signed-in user, responds `200` with
    `{ tier, itemLimit, canPrintLabels, managementURL, itemCount }` (the `SubscriptionStatus`
    fields spread, plus `itemCount`); responds `401 { error: "Unauthorized" }` when signed out.
  - Shared test helpers from `tests/helpers/api-server.ts`: `getFreePort()`,
    `spawnNextServer(port: number): Promise<ChildProcess>`, `stopServer(serverProcess: ChildProcess): void`,
    `loginAndGetCookieHeader(email: string, password: string): Promise<string>`.

- [ ] **Step 1: Extract the shared test-server helpers**

Create `tests/helpers/api-server.ts`:

```ts
// tests/helpers/api-server.ts
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";
import { createServerClient } from "@supabase/ssr";

export function getFreePort(): Promise<number> {
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

export async function spawnNextServer(port: number): Promise<ChildProcess> {
  const baseUrl = `http://localhost:${port}`;
  const serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: "pipe",
    detached: true,
  });
  await waitForServer(baseUrl, 60_000);
  return serverProcess;
}

export function stopServer(serverProcess: ChildProcess): void {
  if (serverProcess && serverProcess.pid) {
    try {
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch {
      serverProcess.kill("SIGTERM");
    }
  }
}

// Creates a real Supabase Auth session for the given credentials and returns a
// `Cookie:` header string usable against our own Next.js server — without needing
// a real browser. Uses the same @supabase/ssr package the app itself uses, with a
// cookie adapter that just captures what would be set instead of writing anywhere.
export async function loginAndGetCookieHeader(email: string, password: string): Promise<string> {
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
```

- [ ] **Step 2: Point `tests/api/items.test.ts` at the shared helpers**

In `tests/api/items.test.ts`, find these lines (the top of the file):

```ts
// tests/api/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseClient } from "../../lib/supabase";
```

Replace with:

```ts
// tests/api/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "node:child_process";
import { getSupabaseClient } from "../../lib/supabase";
import {
  getFreePort,
  spawnNextServer,
  stopServer,
  loginAndGetCookieHeader,
} from "../helpers/api-server";
```

Find this block (the `getFreePort`, `waitForServer`, and `loginAndGetCookieHeader` function definitions, everything between the imports and `const hasEnv = ...`):

```ts
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
```

Delete this entire block (it now lives in `tests/helpers/api-server.ts`).

Find this block inside `beforeAll`:

```ts
    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: "pipe",
      detached: true,
    });
    await waitForServer(baseUrl, 60_000);
```

Replace with:

```ts
    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = await spawnNextServer(port);
```

Find this block inside `afterAll`:

```ts
    if (serverProcess && serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
    }
```

Replace with:

```ts
    stopServer(serverProcess);
```

- [ ] **Step 3: Verify the refactor didn't break anything**

Run: `npx tsc --noEmit`
Expected: no errors (the file compiles; `hasEnv` is `false` in this environment so the actual
`describe.skipIf(!hasEnv)` block is skipped at runtime, but it must still type-check).

Run: `npm test -- items.test`
Expected: the file's tests report as skipped (not failing), same as before this refactor —
confirms the extraction didn't change what runs.

- [ ] **Step 4: Add `getItemCount` to `lib/items.ts`**

In `lib/items.ts`, add this export after `listItems` (after its closing `}`, before `getItem`):

```ts
export async function getItemCount(ownerId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 5: Add an integration test for `getItemCount`**

In `tests/lib/items.integration.test.ts`, change the import at the top from:

```ts
import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
  lookupByCode,
  listItems,
} from "../../lib/items";
```

to:

```ts
import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
  lookupByCode,
  listItems,
  getItemCount,
} from "../../lib/items";
```

Then add this test case right after the `"lists items scoped to the requesting owner"` test (before `"a different owner's delete attempt has no effect"`):

```ts
  it("counts items scoped to the requesting owner", async () => {
    const ownerACountBefore = await getItemCount(ownerAId);
    const ownerBCountBefore = await getItemCount(ownerBId);
    const created = await createItem(ownerAId, {
      name: "Count Test Widget",
      quantity: 1,
      reorder_at: null,
      location: null,
      category: null,
      notes: null,
      cost: null,
      price: null,
    });
    expect(await getItemCount(ownerAId)).toBe(ownerACountBefore + 1);
    expect(await getItemCount(ownerBId)).toBe(ownerBCountBefore);
    await deleteItem(ownerAId, created.id);
    expect(await getItemCount(ownerAId)).toBe(ownerACountBefore);
  });
```

- [ ] **Step 6: Create the `GET /api/subscription` route**

Create `app/api/subscription/route.ts`:

```ts
// app/api/subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import { getSubscriptionStatus } from "../../../lib/subscription";
import { getItemCount } from "../../../lib/items";

export async function GET(_request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [status, itemCount] = await Promise.all([
    getSubscriptionStatus(userId),
    getItemCount(userId),
  ]);
  return NextResponse.json({ ...status, itemCount });
}
```

- [ ] **Step 7: Add the route's integration test**

Create `tests/api/subscription.test.ts`:

```ts
// tests/api/subscription.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "node:child_process";
import { getSupabaseClient } from "../../lib/supabase";
import {
  getFreePort,
  spawnNextServer,
  stopServer,
  loginAndGetCookieHeader,
} from "../helpers/api-server";

const hasEnv = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

describe.skipIf(!hasEnv)("subscription API route (integration)", () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;
  let sessionCookie: string;
  let testUserId: string;

  const testEmail = `test-subscription-api-${Date.now()}@example.com`;
  const testPassword = "test-password-not-real-12345";

  beforeAll(async () => {
    const admin = getSupabaseClient();
    const { data: user, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (error || !user.user) throw error ?? new Error("Failed to create test user");
    testUserId = user.user.id;

    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = await spawnNextServer(port);
    sessionCookie = await loginAndGetCookieHeader(testEmail, testPassword);
  }, 90_000);

  afterAll(async () => {
    stopServer(serverProcess);
    const admin = getSupabaseClient();
    if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  });

  it("rejects unauthenticated requests", async () => {
    const res = await fetch(`${baseUrl}/api/subscription`);
    expect(res.status).toBe(401);
  });

  it("returns free-tier status for a brand-new account (no RevenueCat customer)", async () => {
    // REVENUECAT_SECRET_API_KEY is not set in this test run, so getSubscriptionStatus
    // fails closed to the free tier regardless — this asserts that fail-closed
    // behavior surfaces correctly end-to-end through the route, not just in isolation.
    const res = await fetch(`${baseUrl}/api/subscription`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("free");
    expect(body.itemLimit).toBe(50);
    expect(body.canPrintLabels).toBe(false);
    expect(body.itemCount).toBe(0);
  });
});
```

- [ ] **Step 8: Run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean type-check; all tests pass or skip (skipped ones require `SUPABASE_URL` etc.,
absent in this environment) — no failures.

- [ ] **Step 9: Commit**

```bash
git add tests/helpers/api-server.ts tests/api/items.test.ts lib/items.ts \
  tests/lib/items.integration.test.ts app/api/subscription/route.ts tests/api/subscription.test.ts
git commit -m "Add GET /api/subscription route with shared API test helpers"
```

---

### Task 4: Item-limit enforcement on item creation

**Files:**
- Modify: `lib/items.ts` (add `isAtItemLimit`)
- Test: `tests/lib/items.test.ts` (new file, pure unit tests)
- Modify: `app/api/items/route.ts` (`POST` handler)

**Interfaces:**
- Consumes: `getSubscriptionStatus` (`lib/subscription.ts`, Task 1); `getItemCount` (`lib/items.ts`, Task 3).
- Produces (used by Task 8): `POST /api/items` now responds `402 { error: string; code: "item_limit_reached"; itemLimit: number }` instead of creating the item when the owner is at or over their tier's item limit. `export function isAtItemLimit(count: number, itemLimit: number | null): boolean` in `lib/items.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/items.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAtItemLimit } from "../../lib/items";

describe("isAtItemLimit", () => {
  it("is false when count is below the limit", () => {
    expect(isAtItemLimit(49, 50)).toBe(false);
  });

  it("is true when count equals the limit", () => {
    expect(isAtItemLimit(50, 50)).toBe(true);
  });

  it("is true when count exceeds the limit", () => {
    expect(isAtItemLimit(51, 50)).toBe(true);
  });

  it("is always false when the limit is null (unlimited)", () => {
    expect(isAtItemLimit(1_000_000, null)).toBe(false);
  });

  it("is true at count zero when the limit is zero", () => {
    expect(isAtItemLimit(0, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/items.test`
Expected: FAIL — `isAtItemLimit` is not exported from `lib/items.ts` yet.

- [ ] **Step 3: Add `isAtItemLimit` to `lib/items.ts`**

In `lib/items.ts`, add this export right after the `getItemCount` function added in Task 3:

```ts
export function isAtItemLimit(count: number, itemLimit: number | null): boolean {
  return itemLimit !== null && count >= itemLimit;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/items.test`
Expected: PASS — all 5 tests in `tests/lib/items.test.ts` green.

- [ ] **Step 5: Wire the check into the `POST /api/items` route**

In `app/api/items/route.ts`, find:

```ts
// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import { listItems, createItem, parseItemInput, InvalidItemInputError } from "../../../lib/items";
```

Replace with:

```ts
// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import {
  listItems,
  createItem,
  parseItemInput,
  InvalidItemInputError,
  getItemCount,
  isAtItemLimit,
} from "../../../lib/items";
import { getSubscriptionStatus } from "../../../lib/subscription";
```

Find the `POST` handler:

```ts
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

Replace with:

```ts
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

  const [status, itemCount] = await Promise.all([
    getSubscriptionStatus(userId),
    getItemCount(userId),
  ]);
  if (isAtItemLimit(itemCount, status.itemLimit)) {
    return NextResponse.json(
      {
        error: "You've reached your plan's item limit.",
        code: "item_limit_reached",
        itemLimit: status.itemLimit,
      },
      { status: 402 }
    );
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

- [ ] **Step 6: Verify existing item-creation tests still pass**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test -- items.test`
Expected: existing `tests/api/items.test.ts` cases are skipped (no `SUPABASE_URL` in this
environment) — same as before this change, confirming the new check doesn't alter the
route's exported shape or break compilation. (A brand-new free-tier account has 0 items,
well under the 50-item limit, so the new check is a no-op for every existing test case that
does run when credentials are present — this is a deliberate design property, not something
that needs a 50-item test to prove: `isAtItemLimit`'s own unit tests already cover the
boundary exhaustively.)

- [ ] **Step 7: Commit**

```bash
git add lib/items.ts tests/lib/items.test.ts app/api/items/route.ts
git commit -m "Enforce item-count limit on item creation"
```

---

### Task 5: Gate label printing on the item detail page

**Files:**
- Modify: `app/(app)/items/[id]/page.tsx`

**Interfaces:**
- Consumes: `getSubscriptionStatus` (`lib/subscription.ts`, Task 1); `subscription.printLabelsUpgradePrompt` (`lib/i18n/*.ts`, Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Fetch subscription status and gate the print component**

In `app/(app)/items/[id]/page.tsx`, find:

```tsx
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { renderBarcodeSvg } from "../../../../lib/barcode";
```

Replace with:

```tsx
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { getSubscriptionStatus } from "../../../../lib/subscription";
import { renderBarcodeSvg } from "../../../../lib/barcode";
```

Find:

```tsx
  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const barcodeSvg = renderBarcodeSvg(item.sku);
  const dict = getDictionary(getLocale());
```

Replace with:

```tsx
  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const barcodeSvg = renderBarcodeSvg(item.sku);
  const dict = getDictionary(getLocale());
  const subscription = await getSubscriptionStatus(userId);
```

Find:

```tsx
      <BarcodePrintLabel svg={barcodeSvg} name={item.name} sku={item.sku} />
```

Replace with:

```tsx
      {subscription.canPrintLabels ? (
        <BarcodePrintLabel svg={barcodeSvg} name={item.name} sku={item.sku} />
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
          {dict["subscription.printLabelsUpgradePrompt"]}
        </p>
      )}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/items/[id]/page.tsx"
git commit -m "Gate barcode label printing behind BoxBuddy Pro"
```

---

### Task 6: Client-side RevenueCat SDK wrapper

**Files:**
- Create: `lib/revenuecat/client.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `@revenuecat/purchases-js`'s `Purchases` class (already installed, v1.51.2).
- Produces (used by Task 7): `export async function presentPaywall(appUserId: string): Promise<PaywallPurchaseResult>`.

- [ ] **Step 1: Write the client wrapper**

Create `lib/revenuecat/client.ts`:

```ts
// lib/revenuecat/client.ts
"use client";

import { Purchases } from "@revenuecat/purchases-js";
import type { PaywallPurchaseResult } from "@revenuecat/purchases-js";

let configuredForUserId: string | null = null;

function getPurchases(appUserId: string) {
  if (configuredForUserId !== appUserId) {
    Purchases.configure({
      apiKey: process.env.NEXT_PUBLIC_REVENUECAT_API_KEY!,
      appUserId,
    });
    configuredForUserId = appUserId;
  }
  return Purchases.getSharedInstance();
}

// No `htmlTarget` is passed: per RevenueCat's Web SDK, presentPaywall() creates its
// own full-screen overlay when no target element is given — the modern, documented
// approach that needs no custom paywall UI on BoxBuddy's side.
export async function presentPaywall(appUserId: string): Promise<PaywallPurchaseResult> {
  return getPurchases(appUserId).presentPaywall({});
}
```

- [ ] **Step 2: Add the env var placeholder**

In `.env.example`, append after the `REVENUECAT_SECRET_API_KEY` line added in Task 1:

```

# RevenueCat — safe to expose to the browser (RevenueCat's own "publishable" Web Billing
# key, the same trust level as NEXT_PUBLIC_SUPABASE_ANON_KEY). Used by lib/revenuecat/client.ts.
NEXT_PUBLIC_REVENUECAT_API_KEY=
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/revenuecat/client.ts .env.example
git commit -m "Add client-side RevenueCat SDK wrapper"
```

---

### Task 7: `UpgradeButton` component

**Files:**
- Create: `components/UpgradeButton.tsx`

**Interfaces:**
- Consumes: `presentPaywall` (`lib/revenuecat/client.ts`, Task 6); `useTranslation` (`lib/i18n/client.tsx`); `subscription.upgradeButton`, `subscription.paywallError` (Task 2); `PurchasesError`, `ErrorCode` from `@revenuecat/purchases-js`.
- Produces (used by Task 8): `UpgradeButton` component with props
  `{ appUserId: string; onSuccess: () => void; className?: string }`. Renders a button that,
  on click, calls `presentPaywall(appUserId)`; on success calls `onSuccess()`; on a
  user-cancelled rejection does nothing (no error shown); on any other rejection shows
  `subscription.paywallError` beneath the button.

- [ ] **Step 1: Write the component**

Create `components/UpgradeButton.tsx`:

```tsx
// components/UpgradeButton.tsx
"use client";

import { useState } from "react";
import { PurchasesError, ErrorCode } from "@revenuecat/purchases-js";
import { presentPaywall } from "../lib/revenuecat/client";
import { useTranslation } from "../lib/i18n/client";

export function UpgradeButton({
  appUserId,
  onSuccess,
  className,
}: {
  appUserId: string;
  onSuccess: () => void;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  async function handleClick() {
    setError(false);
    try {
      await presentPaywall(appUserId);
      onSuccess();
    } catch (err) {
      if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
        return;
      }
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={className ?? "rounded-lg bg-orange-400 p-2 text-sm font-medium text-white"}
      >
        {t("subscription.upgradeButton")}
      </button>
      {error && <p className="text-sm text-red-600">{t("subscription.paywallError")}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/UpgradeButton.tsx
git commit -m "Add UpgradeButton component"
```

---

### Task 8: Wire subscription UI into Settings and item creation, document prerequisites

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Modify: `components/ItemForm.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `UpgradeButton` (Task 7); `GET /api/subscription` (Task 3); `subscription.*` keys (Task 2); `POST /api/items`'s `402 { code: "item_limit_reached" }` response (Task 4).
- Produces: nothing consumed elsewhere — final integration point.

- [ ] **Step 1: Add the Subscription section to Settings**

In `app/(app)/settings/page.tsx`, find:

```tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { apiFetch } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n/client";
import type { Locale } from "../../../lib/i18n/types";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { locale, t, setLocale } = useTranslation();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);
```

Replace with:

```tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { apiFetch } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n/client";
import { UpgradeButton } from "../../../components/UpgradeButton";
import type { Locale } from "../../../lib/i18n/types";
import type { TranslationKey } from "../../../lib/i18n/types";
import type { SubscriptionTier } from "../../../lib/subscription";

type SubscriptionSummary = {
  tier: SubscriptionTier;
  itemLimit: number | null;
  canPrintLabels: boolean;
  managementURL: string | null;
  itemCount: number;
};

const TIER_LABEL_KEYS: Record<SubscriptionTier, TranslationKey> = {
  free: "subscription.tierFree",
  monthly: "subscription.tierMonthly",
  yearly: "subscription.tierYearly",
  lifetime: "subscription.tierLifetime",
};

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const router = useRouter();
  const { locale, t, setLocale } = useTranslation();

  async function fetchSubscription() {
    setSubscriptionError(false);
    const res = await apiFetch("/api/subscription");
    if (!res.ok) {
      setSubscriptionError(true);
      return;
    }
    setSubscription(await res.json());
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
    fetchSubscription();
  }, []);
```

- [ ] **Step 2: Render the Subscription section**

In `app/(app)/settings/page.tsx`, find:

```tsx
      <button
        onClick={handleLogout}
        className="rounded-lg border border-stone-300 p-3 text-stone-600"
      >
        {t("settings.logOut")}
      </button>
```

Replace with:

```tsx
      <div className="flex flex-col gap-2">
        <span className="text-sm text-stone-600">{t("subscription.sectionTitle")}</span>
        {subscriptionError ? (
          <p className="text-sm text-red-600">{t("subscription.loadFailed")}</p>
        ) : subscription ? (
          <>
            <p className="text-sm text-stone-600">
              {t(TIER_LABEL_KEYS[subscription.tier])} —{" "}
              {subscription.itemLimit === null
                ? t("subscription.unlimitedItems")
                : `${subscription.itemCount} / ${subscription.itemLimit} ${t("dashboard.itemsLabel")}`}
            </p>
            {subscription.tier !== "lifetime" && userId && (
              <UpgradeButton appUserId={userId} onSuccess={fetchSubscription} />
            )}
            {subscription.managementURL && (
              <a
                href={subscription.managementURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-500 underline"
              >
                {t("subscription.manageSubscriptionLink")}
              </a>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-500">{t("subscription.loading")}</p>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-stone-300 p-3 text-stone-600"
      >
        {t("settings.logOut")}
      </button>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Handle the item-limit response in `ItemForm`**

In `components/ItemForm.tsx`, find:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";
import { FieldLabel } from "./FieldLabel";
import { useTranslation } from "../lib/i18n/client";
```

Replace with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";
import { FieldLabel } from "./FieldLabel";
import { UpgradeButton } from "./UpgradeButton";
import { useTranslation } from "../lib/i18n/client";
```

Find:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
  const router = useRouter();
  const { t } = useTranslation();
```

Replace with:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [itemLimitReached, setItemLimitReached] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
```

Find:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
```

Replace with:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setItemLimitReached(false);
```

Find:

```tsx
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? t("itemForm.somethingWentWrong"));
      setSubmitting(false);
      return;
    }
```

Replace with:

```tsx
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.code === "item_limit_reached") {
        setItemLimitReached(true);
        setSubmitting(false);
        return;
      }
      setError(body.error ?? t("itemForm.somethingWentWrong"));
      setSubmitting(false);
      return;
    }
```

Find:

```tsx
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
```

Replace with:

```tsx
      {error && <p className="text-sm text-red-600">{error}</p>}

      {itemLimitReached && userId && (
        <div className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-stone-700">{t("subscription.itemLimitReachedMessage")}</p>
          <UpgradeButton appUserId={userId} onSuccess={() => setItemLimitReached(false)} />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass or skip (no failures).

- [ ] **Step 6: Manual verification checklist (requires real credentials — document, don't skip)**

This environment has neither Supabase nor RevenueCat credentials configured, so none of the
following can be clicked through here — same caveat as every prior feature in this project.
Once `.env.local` has both RevenueCat keys and the dashboard prerequisites (Step 7 below) are
done, verify by hand:

1. Sign up/log in with a fresh account → Settings shows "Free" and "0 / 50 items".
2. Create items up to 50 → the 51st create attempt shows the item-limit message and an
   Upgrade button instead of saving.
3. Click Upgrade (from Settings or the item-limit prompt) → RevenueCat's hosted, full-screen
   paywall opens showing all three products (Monthly/Yearly/Lifetime).
4. Complete a sandbox purchase (a `test_`-prefixed key implies sandbox mode, no real payment
   needed) → the paywall closes, Settings updates to the purchased tier without a page reload.
5. Item limit is now 500 (Monthly/Yearly) or unlimited (Lifetime); creating more items beyond
   the old 50-item cap now succeeds.
6. The item detail page's print-label section now shows the real `BarcodePrintLabel`
   component instead of the upgrade prompt.
7. Settings shows a "Manage subscription" link that opens RevenueCat's real management URL
   in a new tab.
8. Cancel the paywall without purchasing (close/back) → no error is shown, nothing changes.
9. Force an error (e.g. temporarily use an invalid `NEXT_PUBLIC_REVENUECAT_API_KEY`) → the
   paywall attempt shows `subscription.paywallError` instead of a crash or silent failure.

- [ ] **Step 7: Document the RevenueCat dashboard prerequisites in README**

In `README.md`, find:

```markdown
## Testing
```

Replace with:

```markdown
## RevenueCat subscriptions (BoxBuddy Pro)

BoxBuddy Pro is a three-tier subscription (Monthly/Yearly/Lifetime) via
[RevenueCat](https://www.revenuecat.com/)'s Web SDK. None of the following is doable from
code — it must be set up once in the RevenueCat dashboard before the feature works:

1. Create three products with these exact identifiers: `monthly`, `yearly`, `lifetime`.
2. Create an entitlement with the exact identifier `BoxBuddy Pro`, attached to all three
   products.
3. Create one Offering (e.g. `default`) containing all three as packages, and mark it
   "current".
4. Connect a payment provider (Stripe, Paddle, or RevenueCat Billing) to enable checkout.
5. Generate a **Secret** API key with subscriber-read access — this is
   `REVENUECAT_SECRET_API_KEY` below, separate from the publishable key.
6. Add both keys to `.env.local`:
   - `NEXT_PUBLIC_REVENUECAT_API_KEY` — the publishable Web Billing key. Safe for client
     exposure by RevenueCat's own design.
   - `REVENUECAT_SECRET_API_KEY` — server-only, used by `lib/subscription.ts`'s REST calls
     to authoritatively resolve a user's tier. Never expose this to the browser.

A `test_`-prefixed publishable key implies RevenueCat's sandbox mode — the full paywall and
purchase flow can be verified end to end without a real payment.

**Tier rules** (`TIER_RULES` in `lib/subscription.ts`): free = 50 items, no label printing;
Monthly/Yearly = 500 items, label printing enabled; Lifetime = unlimited items, label
printing enabled. If a user's item count already exceeds their tier's limit (e.g. after a
downgrade), existing items are never hidden or deleted — only creating additional items is
blocked.

## Testing
```

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/settings/page.tsx" components/ItemForm.tsx README.md
git commit -m "Wire subscription UI into Settings and item creation"
```
