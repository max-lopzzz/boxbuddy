// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import {
  listItems,
  createItem,
  parseItemInput,
  InvalidItemInputError,
  getItemCount,
  isAtItemLimit,
} from "../../../lib/items";
import { getSubscriptionStatus } from "../../../lib/subscription";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const items = await listItems(userId, search);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let input;
  try {
    input = parseItemInput(await request.json());
  } catch (error: any) {
    if (error instanceof InvalidItemInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [status, itemCount] = await Promise.all([
    getSubscriptionStatus(userId),
    getItemCount(userId),
  ]);
  if (isAtItemLimit(itemCount, status.itemLimit)) {
    return NextResponse.json(
      {
        error: "You've reached your plan's item limit.",
        code: "item_limit_reached",
        itemLimit: status.itemLimit,
      },
      { status: 402 }
    );
  }

  try {
    const item = await createItem(userId, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "This code is already used by another item." },
        { status: 409 }
      );
    }
    throw error;
  }
}
