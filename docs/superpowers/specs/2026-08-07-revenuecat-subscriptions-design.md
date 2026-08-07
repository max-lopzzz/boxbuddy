# BoxBuddy — RevenueCat Subscriptions (BoxBuddy Pro) Design

## Overview

BoxBuddy currently has no free/paid distinction — every logged-in account has identical,
unlimited access. This design introduces a "BoxBuddy Pro" entitlement via RevenueCat's Web
SDK (`@revenuecat/purchases-js`, already added to `package.json`), with three purchasable
tiers gated behind that one entitlement and differentiated by which product granted it:

| Tier | RevenueCat product identifier | Item limit | Label printing |
|---|---|---|---|
| Free (no active entitlement) | — | 50 | Disabled |
| Monthly | `monthly` | 500 | Enabled |
| Yearly | `yearly` | 500 | Enabled |
| Lifetime | `lifetime` | Unlimited | Enabled |

## Goals

- Configure the RevenueCat Web SDK client-side, identifying each customer by their existing
  Supabase user ID (`appUserId`) — a RevenueCat customer maps 1:1 to a BoxBuddy account.
- Present RevenueCat's hosted Paywall (`presentPaywall`) to let a user purchase any of the
  three products.
- Authoritatively resolve a user's tier **server-side** (not trusting the client) via
  RevenueCat's REST API, using a server-only Secret API key.
- Enforce the item-count limit at item creation (`POST /api/items`), returning a distinguishable
  error the client turns into an upgrade prompt.
- Gate label printing (`components/BarcodePrintLabel.tsx`) server-side on the item detail page.
- Add a "Subscription" section to Settings: current tier, item usage, an Upgrade action, and —
  since RevenueCat's Customer Center is iOS/Android-only and unavailable on the Web SDK — a
  "Manage subscription" link using `customerInfo.managementURL` for Pro users instead.

## Non-Goals

- RevenueCat dashboard configuration (creating the `monthly`/`yearly`/`lifetime` products, the
  `"BoxBuddy Pro"` entitlement, an Offering containing all three, and connecting a payment
  provider) — none of this is doable from code. Documented as an explicit prerequisite checklist
  below; the implementation assumes it is done before the feature can be manually verified.
- RevenueCat's Customer Center — confirmed unsupported on the Web SDK (iOS/Android only as of
  this writing). `managementURL` is the web-appropriate substitute.
- Webhooks or any local caching of subscription state (e.g. a Supabase table/column mirroring
  RevenueCat) — the REST API is queried live on each enforcement check instead. See "Server-side
  tier resolution" below for the tradeoff.
- Multi-currency / localized pricing configuration — RevenueCat's hosted paywall handles this;
  no BoxBuddy-side currency logic.
- Restoring purchases across devices — a mobile-SDK concept tied to device-local receipts; the
  Web SDK's account-based model (a RevenueCat customer *is* the Supabase account) makes this
  inapplicable.
- Downgrading behavior beyond blocking new item creation — if a user's item count already
  exceeds their new (lower) tier's limit after a cancellation/downgrade, existing items are never
  hidden, archived, or deleted. Only creating additional items is blocked.

## Architecture

### Client-side SDK (`lib/revenuecat/client.ts`, `"use client"`)

A singleton wrapper around `Purchases.configure()`, configured once per browser session:

```ts
import { Purchases } from "@revenuecat/purchases-js";

let configured = false;

export function getPurchases(appUserId: string) {
  if (!configured) {
    Purchases.configure({
      apiKey: process.env.NEXT_PUBLIC_REVENUECAT_API_KEY!,
      appUserId,
    });
    configured = true;
  }
  return Purchases.getSharedInstance();
}
```

`appUserId` is always the current Supabase user's `id` (from `supabase.auth.getUser()`,
client-side) — never RevenueCat's anonymous-ID path, since every BoxBuddy route already requires
a signed-in account (`app/(app)/layout.tsx` redirects to `/signup` otherwise).

Thin wrappers used by UI components:
- `getOfferings()` → `purchases.getOfferings()`
- `presentPaywall(target, offering?)` → `purchases.presentPaywall({ htmlTarget: target, offering })`
- `getCustomerInfo()` → `purchases.getCustomerInfo()`

### Server-side tier resolution (`lib/subscription.ts`, `server-only`)

Mirrors the existing `lib/auth.ts` pattern (a `server-only`-marked module called from Server
Components and API routes). Calls RevenueCat's REST API directly — **not** a database cache —
so subscription status is always current with no webhook infrastructure to build or secure:

```
GET https://api.revenuecat.com/v1/subscribers/{appUserId}
Authorization: Bearer REVENUECAT_SECRET_API_KEY
```

Response shape (verbatim from RevenueCat's docs):

```json
{
  "subscriber": {
    "entitlements": {
      "BoxBuddy Pro": {
        "expires_date": null,
        "product_identifier": "lifetime",
        "purchase_date": "2026-08-07T12:00:00Z"
      }
    }
  }
}
```

An entitlement is active when its key is present **and** (`expires_date` is `null` — the
lifetime case — **or** `expires_date` is in the future). `product_identifier` says which of
`monthly` / `yearly` / `lifetime` granted it, which is how the item-limit tier is chosen even
though all three share one entitlement.

```ts
import "server-only";

export type SubscriptionTier = "free" | "monthly" | "yearly" | "lifetime";

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  itemLimit: number | null; // null = unlimited
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

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  // fetch RevenueCat's /v1/subscribers/{userId}, resolve `tier` from the active
  // "BoxBuddy Pro" entitlement's product_identifier (or "free" if absent/expired),
  // look up TIER_RULES[tier], and read managementURL from the subscriber object.
  // On any fetch/parse failure: fail closed to `free` tier (see Error Handling).
}
```

`ENTITLEMENT_ID` and the three product identifiers are the single source of truth this module
and the client module both key off of — no duplicated string literals beyond this file.

## Enforcement Points

- **Item creation** (`lib/items.ts` `createItem`, called from `app/api/items/route.ts` `POST`):
  before inserting, count the owner's existing items
  (`select count(*, exact) from items where owner_id = ownerId`) and call
  `getSubscriptionStatus(ownerId)`. If `itemLimit !== null && count >= itemLimit`, the route
  returns `402 Payment Required` with `{ error: "item_limit_reached", itemLimit }` — a
  machine-readable code, not just a string, so the client can distinguish this from any other
  validation error and show an upgrade prompt instead of a generic failure message.
- **Label printing** (`app/(app)/items/[id]/page.tsx`, a Server Component): calls
  `getSubscriptionStatus(userId)` once during render. If `canPrintLabels` is `false`, an
  "Upgrade to print labels" prompt renders in place of `<BarcodePrintLabel>` — gated at the
  server-render boundary, no separate client-side check needed since printing has no API call
  to protect independently.
- **`GET /api/subscription`**: a new route wrapping `getSubscriptionStatus` for the current user,
  for client components that need read access — Settings' Subscription section, and an item-count
  indicator surfaced near "Add item" so a free-tier user sees they're approaching the cap before
  hitting the hard block.

## UI / UX

- **Settings** (`app/(app)/settings/page.tsx`) gains a new section between the password form and
  the language switcher:
  - Current tier name and item usage (`"42 / 50 items"`, or `"Unlimited"` for Lifetime).
  - **Upgrade** button (hidden for Lifetime tier) opens a modal containing a target `<div>` that
    `presentPaywall({ htmlTarget })` renders RevenueCat's hosted paywall into. On the resolved
    promise, close the modal and refetch `/api/subscription` to reflect the new tier
    immediately. On `PurchasesError` with `ErrorCode.UserCancelledError`, close quietly (no error
    shown). On any other error, show a translated error message and keep the modal open so the
    user can retry.
  - **Manage subscription** link (shown only when a subscription is active) opens
    `customerInfo.managementURL` in a new tab — the web-appropriate substitute for RevenueCat's
    Customer Center, which does not support the Web SDK.
- **Item-limit reached**: the "Add item" flow's `402` response opens the same upgrade modal
  used in Settings, rather than a raw error banner.
- New i18n keys for all of the above added to both `lib/i18n/en.ts` and `lib/i18n/es.ts`,
  following the existing flat-key pattern (e.g. `subscription.upgradeButton`,
  `subscription.itemLimitReached`, `subscription.manageSubscription`).

## Configuration & Prerequisites

**Env vars** (added to `.env.example` as placeholders; real values go in `.env.local`, never
committed):
- `NEXT_PUBLIC_REVENUECAT_API_KEY` — the publishable Web Billing key (`test_TySSArkUltPVPWtKsdZVDzGgusT`
  for now). Safe for client exposure by RevenueCat's own design — this is the intended use of a
  "public" key, same trust level as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `REVENUECAT_SECRET_API_KEY` — server-only, used only by `lib/subscription.ts`'s REST calls.
  Not provided in this design (secret keys are never pasted into chat); the user adds it to
  `.env.local` themselves.

**RevenueCat dashboard setup** (manual, outside code — must be done before this feature is
usable, and before any manual browser verification of it):
1. Create three products: `monthly`, `yearly`, `lifetime` (identifiers must match exactly —
   these are the literal strings the code keys tier-detection off of).
2. Create an entitlement with identifier `BoxBuddy Pro` (confirmed as the literal dashboard
   identifier, not just a display name), attached to all three products.
3. Create one Offering (e.g. `default`) containing all three as packages, and mark it "current".
4. Connect a payment provider (Stripe, Paddle, or RevenueCat Billing) to enable checkout.
5. Generate a **Secret** API key (`REVENUECAT_SECRET_API_KEY`) with subscriber-read access, for
   the server-side REST lookups — separate from the publishable key already given.

## Error Handling

- `getSubscriptionStatus` fails **closed**: any network error, non-2xx response, or unexpected
  JSON shape from RevenueCat's REST API resolves to `{ tier: "free", itemLimit: 50,
  canPrintLabels: false, managementURL: null }` rather than throwing — an outage never grants
  unlimited access. The failure is logged server-side (not surfaced to the user as a stack
  trace); the user sees the same UI a real free-tier user would see. Print-gating degrades the
  same way (button hidden) rather than crashing the item detail page.
- Client SDK configuration failure (bad key, network unreachable): Settings' Subscription
  section shows "Couldn't load your subscription info. Try again." instead of crashing the page.
- `presentPaywall` rejection: `UserCancelledError` closes the modal silently; any other error
  shows a translated message and leaves the modal open to retry.
- A `402 item_limit_reached` response from item creation is never treated as an unexpected
  error by the item form — it's an expected, handled outcome that opens the upgrade modal.

## Testing

- Unit tests for the pure tier-resolution logic: given a parsed RevenueCat subscriber JSON
  shape (active entitlement with each of the three `product_identifier`s, no entitlement,
  expired entitlement, malformed/missing fields), assert the correct `SubscriptionStatus` is
  returned — including the fail-closed defaults on malformed input. These test the pure
  parsing/mapping function in isolation from the actual `fetch` call.
- Unit tests for the item-limit-check logic (count vs. tier's `itemLimit`, including the
  `itemLimit === null` unlimited case).
- Manual verification (flagged, same caveat as prior features in this repo): this environment
  has neither Supabase nor RevenueCat credentials configured, so the live paywall/purchase flow,
  the Settings subscription section, and the item-limit/print-gating behavior cannot be clicked
  through here. Requires: completing the dashboard prerequisites above, a `.env.local` with both
  RevenueCat keys, and RevenueCat's own test/sandbox purchase flow (a `test_`-prefixed API key
  implies sandbox mode, so no real payment is needed to verify the full flow end to end).
