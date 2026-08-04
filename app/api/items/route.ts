// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../lib/auth";
import { listItems, createItem } from "../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const items = await listItems(search);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  try {
    const item = await createItem(body);
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
