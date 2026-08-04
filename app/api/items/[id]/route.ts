// app/api/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { getItem, updateItem, deleteItem } from "../../../../lib/items";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const item = await updateItem(params.id, body);
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteItem(params.id);
  return NextResponse.json({ ok: true });
}
