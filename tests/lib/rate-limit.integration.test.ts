import { describe, it, expect } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
import { isRateLimited, recordLoginAttempt } from "../../lib/rate-limit";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEST_IP = "203.0.113.5"; // TEST-NET-3, reserved for documentation/testing

describe.skipIf(!hasEnv)("rate limiting (integration)", () => {
  it("is not rate limited before any attempts", async () => {
    const supabase = getSupabaseClient();
    await supabase.from("login_attempts").delete().eq("ip", TEST_IP);
    expect(await isRateLimited(TEST_IP)).toBe(false);
  });

  it("becomes rate limited after 5 attempts within the window", async () => {
    for (let i = 0; i < 5; i++) {
      await recordLoginAttempt(TEST_IP);
    }
    expect(await isRateLimited(TEST_IP)).toBe(true);
  });
});
