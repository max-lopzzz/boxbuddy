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
