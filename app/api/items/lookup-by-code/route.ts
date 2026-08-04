// app/api/items/lookup-by-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { lookupByCode } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const item = await lookupByCode(code);
  return NextResponse.json({ item });
}
