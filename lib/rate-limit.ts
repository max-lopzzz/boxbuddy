// lib/rate-limit.ts
import { getSupabaseClient } from "./supabase";

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function isRateLimited(ip: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) >= MAX_ATTEMPTS;
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("login_attempts").insert({ ip });
  if (error) throw error;
}
