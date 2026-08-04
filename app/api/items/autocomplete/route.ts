// app/api/items/autocomplete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../lib/auth";
import { autocompleteValues } from "../../../../lib/items";

export async function GET(request: NextRequest) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const field = request.nextUrl.searchParams.get("field");
  const search = request.nextUrl.searchParams.get("q") ?? "";
  if (field !== "location" && field !== "category") {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }
  const values = await autocompleteValues(field, search);
  return NextResponse.json({ values });
}
