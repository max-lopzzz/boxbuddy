import { describe, it, expect } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("Supabase connection", () => {
  it("can query the items table", async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("items").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("can query the app_settings table", async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("app_settings").select("id").limit(1);
    expect(error).toBeNull();
  });
});
