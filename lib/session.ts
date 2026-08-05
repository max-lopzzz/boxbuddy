import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "bb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function sign(payloadB64: string, keyMaterial: string): string {
  return crypto.createHmac("sha256", keyMaterial).update(payloadB64).digest("base64url");
}

export function createSessionToken(keyMaterial: string): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, keyMaterial)}`;
}

export function verifySessionToken(token: string | undefined | null, keyMaterial: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  const expectedSignature = sign(payloadB64, keyMaterial);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}
