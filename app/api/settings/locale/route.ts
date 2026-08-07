// app/api/settings/locale/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import { getSupabaseClient } from "../../../../lib/supabase";
import { LOCALE_COOKIE } from "../../../../lib/i18n/constants";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.locale !== "en" && body.locale !== "es") {
    return NextResponse.json({ error: "locale must be 'en' or 'es'" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { locale: body.locale },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCALE_COOKIE, body.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
