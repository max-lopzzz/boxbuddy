// app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import {
  getItem,
  updateItem,
  deleteItem,
  parseItemInput,
  InvalidItemInputError,
} from "../../../../lib/items";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(userId, params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
  try {
    const item = await updateItem(userId, params.id, input);
    return NextResponse.json({ item });
  } catch (error: any) {
    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "This code is already used by another item." },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteItem(userId, params.id);
  return NextResponse.json({ ok: true });
}
