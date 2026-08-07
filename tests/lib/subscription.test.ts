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
