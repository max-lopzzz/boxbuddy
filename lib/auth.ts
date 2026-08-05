// lib/auth.ts
import "server-only";
import { createSupabaseServerClient } from "./supabase/server";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
