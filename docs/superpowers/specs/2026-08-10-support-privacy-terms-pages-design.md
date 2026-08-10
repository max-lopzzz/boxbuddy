# BoxBuddy — Support / Privacy Policy / Terms of Service Pages Design

## Overview

RevenueCat's Web Billing app setup (and typically Stripe/app-store review) requires three
URLs: a customer support contact, a privacy policy, and terms of service. BoxBuddy has none
of these today. This design adds three public, bilingual pages so those URLs point at real
content instead of a placeholder.

## Goals

- Three new public pages, reachable without signing in: `/support`, `/privacy`, `/terms`.
- Support page shows a contact email (`m.lopz.montn@gmail.com`).
- Privacy Policy accurately describes what BoxBuddy actually collects and through which
  third parties (Supabase, RevenueCat, Stripe), in plain language.
- Terms of Service covers subscription billing, cancellation, acceptable use, and standard
  liability/warranty disclaimers appropriate for a solo/indie project with no registered
  legal entity.
- Both legal pages are governed by the laws of Mexico (matching the target market implied by
  earlier MXN pricing discussion) and reference "BoxBuddy" itself rather than inventing a
  registered company name or a physical address that doesn't exist.
- Bilingual (English/Spanish), consistent with the rest of the app.
- Discoverable: linked from the pre-auth pages (login/signup) where an unauthenticated
  visitor or a reviewer would look.

## Non-Goals

- No legal review — this is boilerplate appropriate for launch, explicitly not a substitute
  for a lawyer. Flagged to the user as such.
- No cookie-consent banner or granular cookie-preference UI — out of scope; the Privacy
  Policy simply discloses the two cookies BoxBuddy sets (auth session, language preference).
- No account-deletion self-service flow — the Privacy Policy states data is retained until
  account deletion and that deletion requests go through the support email, since no
  in-app "delete my account" feature exists yet.
- No changes to `lib/i18n/en.ts` / `lib/i18n/es.ts` — see Architecture below for why.

## Architecture

- **Routes**: `app/support/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx` — new
  top-level routes, siblings of `app/login/page.tsx` and `app/signup/page.tsx`, outside the
  `(app)` route group (which requires a signed-in session via
  `app/(app)/layout.tsx`'s `redirect("/signup")`). These three routes must be reachable with
  no account.
- **Rendering**: Server Components, using `getLocale()` from `lib/i18n/server.ts` (the same
  cookie-based locale detection already used server-side elsewhere, e.g. the item detail
  page). No client-side JavaScript needed for static text, and server-rendered content is
  more reliably readable by non-JS review/crawler tools (RevenueCat, app-store review,
  Stripe compliance checks) than a client-hydrated page.
- **Content storage — deliberately NOT in `lib/i18n/en.ts`/`es.ts`**: those two files hold
  short, reusable UI strings (button labels, hints) shared across many components. Each of
  these three pages has a few hundred words of one-off prose used nowhere else. Adding that
  as dozens of new flat keys would bloat the shared dictionaries with content that has
  exactly one consumer. Instead, each page file defines its own bilingual content object:
  ```ts
  const content: Record<Locale, { title: string; sections: { heading: string; body: string }[] }> = {
    en: { title: "...", sections: [{ heading: "...", body: "..." }, ...] },
    es: { title: "...", sections: [...] },
  };
  ```
  The page reads `getLocale()` and renders `content[locale]`. This keeps the shared
  dictionaries clean and keeps each page's content colocated with its only consumer — the
  same "smaller, well-bounded units" principle already followed elsewhere in this codebase.
- **Discovery**: `app/login/page.tsx` and `app/signup/page.tsx` gain a small text-row footer
  with links to all three pages — plain text links, not a visual redesign, matching the
  existing minimal styling of those pages.

## Content

- **Support**: one sentence of context plus a `mailto:m.lopz.montn@gmail.com` link.
- **Privacy Policy sections**: what's collected (account email via Supabase Auth; inventory
  data — item names, quantities, costs, prices, optional photos; subscription/payment data
  via RevenueCat and Stripe); why it's collected (to provide the service); that it is never
  sold; the three third-party processors named explicitly (Supabase, RevenueCat, Stripe);
  data retention (kept until account deletion, requested via the support email); cookies
  (the auth session cookie and the `boxbuddy_locale` language-preference cookie); contact;
  governing law (Mexico).
- **Terms of Service sections**: acceptance of terms; account eligibility/responsibility;
  subscription billing (auto-renewal, cancellation via the in-app "Manage subscription" link
  added in the RevenueCat feature, the free tier's 50-item limit); acceptable use; service
  provided "as is" with no warranty; limitation of liability; right to modify or discontinue
  the service; changes to these terms; governing law (Mexico); contact.

## Error Handling

- None of these pages have any I/O, form submission, or dynamic data — there is no failure
  mode beyond a general Next.js routing error, which is out of scope (handled the same way
  as any other page in this app).

## Testing

- No automated test — this repo has no tests for static page content (matching the existing
  pattern: `tests/` covers `lib/*` logic and API routes, not page rendering). Verified by
  `npx tsc --noEmit` and manual review of the rendered English and Spanish content.
- Manual verification: visit all three pages in both languages (toggle via the existing
  language switcher in Settings, or the `boxbuddy_locale` cookie), confirm the login/signup
  footer links resolve correctly, and confirm the pages render without being signed in.
