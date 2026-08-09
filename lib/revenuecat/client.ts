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
