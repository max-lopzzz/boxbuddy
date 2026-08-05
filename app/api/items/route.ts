// app/api/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../lib/auth";
import { listItems, createItem, parseItemInput, InvalidItemInputError } from "../../../lib/items";

export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const items = await listItems(search);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
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
  try {
    const item = await createItem(input);
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
