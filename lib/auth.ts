// lib/auth.ts
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { getSessionKeyMaterial } from "./passcode";

export async function hasValidSession(): Promise<boolean> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const keyMaterial = await getSessionKeyMaterial();
  return verifySessionToken(token, keyMaterial);
}
