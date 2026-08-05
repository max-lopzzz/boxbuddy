import { describe, it, expect, afterAll } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
import { verifyPasscode, setPasscode, getSessionKeyMaterial } from "../../lib/passcode";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("passcode storage (integration)", () => {
  afterAll(async () => {
    // Restore the original .env.local APP_PASSCODE so login keeps working after this test run.
    if (process.env.APP_PASSCODE) {
      await setPasscode(process.env.APP_PASSCODE);
    }
  });

  it("initializes from APP_PASSCODE on first use and verifies correctly", async () => {
    const supabase = getSupabaseClient();
    await supabase.from("app_settings").delete().eq("id", 1);
    expect(await verifyPasscode(process.env.APP_PASSCODE!)).toBe(true);
    expect(await verifyPasscode("definitely-wrong")).toBe(false);
  });

  it("setPasscode changes what verifies successfully", async () => {
    await setPasscode("a-new-test-passcode");
    expect(await verifyPasscode("a-new-test-passcode")).toBe(true);
    expect(await verifyPasscode(process.env.APP_PASSCODE!)).toBe(false);
  });

  it("rotating the passcode changes the session key material, invalidating prior tokens", async () => {
    // Ensure a known-good starting state regardless of test execution order.
    await setPasscode(process.env.APP_PASSCODE!);
    const keyMaterialBefore = await getSessionKeyMaterial();

    await setPasscode("a-different-test-passcode-for-key-material-test");
    const keyMaterialAfter = await getSessionKeyMaterial();

    expect(keyMaterialAfter).not.toBe(keyMaterialBefore);
    // afterAll below restores APP_PASSCODE so subsequent logins keep working.
  });
});
