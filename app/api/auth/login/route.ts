import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../../../lib/session";
import { verifyPasscode, getSessionKeyMaterial } from "../../../../lib/passcode";
import { isRateLimited, recordLoginAttempt } from "../../../../lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const { passcode } = await request.json();
  await recordLoginAttempt(ip);

  if (typeof passcode !== "string" || !(await verifyPasscode(passcode))) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const keyMaterial = await getSessionKeyMaterial();
  const token = createSessionToken(keyMaterial);
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
