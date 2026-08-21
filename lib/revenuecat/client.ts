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

// RevenueCat's paywall locale codes don't match BoxBuddy's own two-letter `Locale`
// values — they're specific RevenueCat-defined codes (see
// https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/localization),
// and only a locale that actually has translated paywall content configured in the
// RevenueCat dashboard (Paywall Editor → Localization) will render — anything else
// silently falls back to the paywall's default/base content. BoxBuddy's Spanish
// content in RevenueCat is specifically "Spanish (Mexico)", whose code is "es_MX",
// not the generic "es". English has no explicit code here because it's the
// paywall's default/base language, not a separately-added localization.
const REVENUECAT_PAYWALL_LOCALE: Partial<Record<Locale, string>> = {
  es: "es_MX",
};

// No `htmlTarget` is passed: per RevenueCat's Web SDK, presentPaywall() creates its
// own full-screen overlay when no target element is given — the modern, documented
// approach that needs no custom paywall UI on BoxBuddy's side.
export async function presentPaywall(
  appUserId: string,
  locale: Locale
): Promise<PaywallPurchaseResult> {
  const selectedLocale = REVENUECAT_PAYWALL_LOCALE[locale];
  return getPurchases(appUserId).presentPaywall(selectedLocale ? { selectedLocale } : {});
}
