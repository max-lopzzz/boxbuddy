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
  const isNonExpiring = expiresDate === null;
  const expiryMs = typeof expiresDate === "string" ? new Date(expiresDate).getTime() : NaN;
  const isExpired = !isNonExpiring && (Number.isNaN(expiryMs) || expiryMs <= Date.now());
  if (isExpired) {
    return { ...FREE_TIER_STATUS, managementURL };
  }

  // A manual/promotional grant from the RevenueCat dashboard (used e.g. for support
  // comps or dev testing) reaches this entitlement with a synthetic identifier like
  // "rc_promo_boxbuddy_pro_lifetime", not one of the real store product ids above.
  // The entitlement is still active and unexpired at this point, so treat any
  // unrecognized-but-active product as full (lifetime-equivalent) access instead of
  // silently downgrading a granted user to the free tier.
  const productIdentifier = e.product_identifier;
  const tier: SubscriptionTier = isKnownProduct(productIdentifier) ? productIdentifier : "lifetime";
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
      signal: AbortSignal.timeout(3000),
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
