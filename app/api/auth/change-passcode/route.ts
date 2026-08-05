import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { verifyPasscode, setPasscode } from "../../../../lib/passcode";

export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { current, next } = await request.json();
  if (typeof current !== "string" || !(await verifyPasscode(current))) {
    return NextResponse.json({ error: "Current passcode is incorrect" }, { status: 401 });
  }
  if (typeof next !== "string" || next.length < 4) {
    return NextResponse.json({ error: "New passcode must be at least 4 characters" }, { status: 400 });
  }
  await setPasscode(next);
  return NextResponse.json({ ok: true });
}
