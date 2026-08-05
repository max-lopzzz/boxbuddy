// app/api/items/[id]/photo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "../../../../../lib/auth";
import { uploadPhoto, getSignedPhotoUrl } from "../../../../../lib/storage";
import { getItem, updateItem } from "../../../../../lib/items";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getItem(params.id);
  if (!item?.photo_url) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  const signedUrl = await getSignedPhotoUrl(item.photo_url);
  return NextResponse.redirect(signedUrl);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Photo must be 5MB or smaller" }, { status: 413 });
  }
  const path = await uploadPhoto(params.id, file);
  await updateItem(params.id, { photo_url: path });
  const signedUrl = await getSignedPhotoUrl(path);
  return NextResponse.json({ photo_url: path, signed_url: signedUrl });
}
