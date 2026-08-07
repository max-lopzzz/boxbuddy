// app/api/subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import { getSubscriptionStatus } from "../../../lib/subscription";
import { getItemCount } from "../../../lib/items";

export async function GET(_request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [status, itemCount] = await Promise.all([
    getSubscriptionStatus(userId),
    getItemCount(userId),
  ]);
  return NextResponse.json({ ...status, itemCount });
}
