import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function POST() {
  cookies().delete({ name: SESSION_COOKIE_NAME, path: "/" });
  return NextResponse.json({ ok: true });
}
