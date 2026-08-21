// lib/revenuecat/client.ts
"use client";

import { Purchases } from "@revenuecat/purchases-js";
import type { PaywallPurchaseResult } from "@revenuecat/purchases-js";
import type { Locale } from "../i18n/types";

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
//
// `selectedLocale` tells RevenueCat's hosted paywall/checkout which language to render,
// matching BoxBuddy's own language toggle instead of silently following the browser's
// locale. It only takes effect for locales that actually have translated paywall content
// configured in the RevenueCat dashboard (Paywall Editor → Localization) — passing "es"
// here falls back to English if no Spanish paywall content exists there yet.
export async function presentPaywall(
  appUserId: string,
  locale: Locale
): Promise<PaywallPurchaseResult> {
  return getPurchases(appUserId).presentPaywall({ selectedLocale: locale });
}
