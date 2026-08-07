import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "./lib/i18n/constants";
import { detectLocaleFromAcceptLanguage } from "./lib/i18n/detect";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Middleware runs on every matched request (the `config.matcher` below already
    // excludes static assets, so this can't take down icon/manifest requests). Log a
    // clear message first so it's visible in server/Vercel function logs even if the
    // production error response itself is generic, then throw so the failure is loud
    // instead of silently limping along with an unauthenticated Supabase client.
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set";
    console.error(`middleware: ${message}`);
    throw new Error(message);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshes the session (rewriting cookies if the access token was renewed) so
  // Server Components downstream always see a current session.
  await supabase.auth.getUser();

  // Auto-detect the visitor's language on their first visit only — once the cookie
  // exists (from detection or an explicit choice in Settings), never overwrite it here.
  if (!request.cookies.get(LOCALE_COOKIE)) {
    const locale = detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
