// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

// This is a Route Handler (not a Server Component), so the Supabase server
// client's setAll cookie callback can actually persist the session cookie
// here instead of hitting its Server-Component try/catch fallback. That
// means a real session exists by the time we redirect to /reset-password,
// regardless of which device/browser the user opened the email link on —
// unlike the browser-side PKCE flow, whose code verifier only lives on the
// device that requested the reset. The redirect destination is hardcoded
// (not taken from a query parameter) to avoid an open redirect.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid-or-expired-link", request.url));
}
