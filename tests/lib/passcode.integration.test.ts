import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
import { verifyPasscode, setPasscode, getSessionKeyMaterial } from "../../lib/passcode";

const hasEnv = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.APP_PASSCODE
);

describe.skipIf(!hasEnv)("passcode storage (integration)", () => {
  let originalRow: { passcode_hash: string; passcode_salt: string } | null = null;

  beforeAll(async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("app_settings")
      .select("passcode_hash, passcode_salt")
      .eq("id", 1)
      .maybeSingle();
    originalRow = data;
  });

  afterAll(async () => {
    const supabase = getSupabaseClient();
    if (originalRow) {
      // Restore the exact pre-test row, byte-for-byte, regardless of what any test changed it to.
      await supabase
        .from("app_settings")
        .upsert({ id: 1, passcode_hash: originalRow.passcode_hash, passcode_salt: originalRow.passcode_salt });
    } else if (process.env.APP_PASSCODE) {
      // No row existed before this run (fresh project) — seed it from APP_PASSCODE as a fallback.
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
    // afterAll above restores the original DB row so subsequent logins keep working.
  });
});
