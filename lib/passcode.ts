// lib/passcode.ts
import crypto from "node:crypto";
import { getSupabaseClient } from "./supabase";

function hashPasscode(passcode: string, salt: string): string {
  return crypto.scryptSync(passcode, salt, 64).toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function getStoredPasscode(): Promise<{ hash: string; salt: string } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("passcode_hash, passcode_salt")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { hash: data.passcode_hash, salt: data.passcode_salt };
}

export async function setPasscode(passcode: string): Promise<void> {
  const supabase = getSupabaseClient();
  const salt = generateSalt();
  const hash = hashPasscode(passcode, salt);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, passcode_hash: hash, passcode_salt: salt });
  if (error) throw error;
}

async function ensurePasscodeInitialized(): Promise<void> {
  const existing = await getStoredPasscode();
  if (existing) return;
  const initial = process.env.APP_PASSCODE;
  if (!initial) {
    throw new Error("APP_PASSCODE must be set to initialize the passcode for the first time");
  }
  await setPasscode(initial);
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  await ensurePasscodeInitialized();
  const stored = await getStoredPasscode();
  if (!stored) return false;
  const hash = hashPasscode(passcode, stored.salt);
  const a = Buffer.from(hash);
  const b = Buffer.from(stored.hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Returns key material for signing/verifying session tokens, derived from both
 * SESSION_SECRET and the current passcode_hash. Because the passcode hash is
 * part of the key, rotating the passcode (via setPasscode) invalidates every
 * session token that was signed under the old key.
 */
export async function getSessionKeyMaterial(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  await ensurePasscodeInitialized();
  const stored = await getStoredPasscode();
  if (!stored) throw new Error("Passcode is not initialized");
  return `${secret}:${stored.hash}`;
}
