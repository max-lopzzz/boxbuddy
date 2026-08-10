# Support / Privacy Policy / Terms of Service Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three public, bilingual pages — `/support`, `/privacy`, `/terms` — so RevenueCat's Web Billing app setup (and any future app-store review) has real URLs to point at instead of nothing.

**Architecture:** Three new top-level Server Component routes, siblings of the existing `/login` and `/signup` pages (outside the auth-gated `(app)` route group). Each page reads the locale via the existing server-side `getLocale()` helper and renders from a small bilingual content object defined in the page's own file — not added to the shared `lib/i18n/en.ts`/`es.ts` dictionaries, since that content is one-off prose used by exactly one page each, not reusable short UI strings.

**Tech Stack:** Next.js 14 (App Router) Server Components, TypeScript, Tailwind CSS.

Reference spec: `docs/superpowers/specs/2026-08-10-support-privacy-terms-pages-design.md`

## Global Constraints

- Support contact email is exactly `m.lopz.montn@gmail.com`.
- Both legal pages state they are governed by the laws of Mexico, and refer to "BoxBuddy" rather than inventing a registered company name or a physical address.
- All three pages are bilingual (English/Spanish), rendered via `getLocale()` from `lib/i18n/server.ts` (`Locale = "en" | "es"`), matching the pattern already used server-side elsewhere (e.g. the item detail page).
- Page body content (Support/Privacy/Terms prose) is defined as a local `content: Record<Locale, ...>` object inside each page file — NOT added to `lib/i18n/en.ts`/`es.ts`. Only the three short footer link labels (Task 4) go into the shared dictionaries, since those are reusable short UI strings, consistent with everything else already in those files.
- These three routes must be reachable without a signed-in session — they live at the top level (`app/support/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`), not inside `app/(app)/`, which requires auth via `app/(app)/layout.tsx`'s `redirect("/signup")`.
- No automated tests — this repo has no tests for static page content (matching the existing pattern: `tests/` covers `lib/*` logic and API routes, not page rendering). Verification is `npx tsc --noEmit` and manual reading of both language versions.
- No new npm dependencies.

---

### Task 1: Support page

**Files:**
- Create: `app/support/page.tsx`

**Interfaces:**
- Consumes: `getLocale()` (`lib/i18n/server.ts`); `Locale` type (`lib/i18n/types.ts`).
- Produces: nothing consumed by later tasks in this plan (Task 4 links to `/support` by URL only, not by importing anything from this file).

- [ ] **Step 1: Write the page**

Create `app/support/page.tsx`:

```tsx
// app/support/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

const content: Record<Locale, { title: string; intro: string }> = {
  en: {
    title: "Support",
    intro:
      "Need help with BoxBuddy? Send us an email and we'll get back to you as soon as we can.",
  },
  es: {
    title: "Soporte",
    intro: "¿Necesitas ayuda con BoxBuddy? Envíanos un correo y te responderemos lo antes posible.",
  },
};

export default function SupportPage() {
  const locale = getLocale();
  const { title, intro } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="text-sm text-stone-600">{intro}</p>
      <a href="mailto:m.lopz.montn@gmail.com" className="text-sm text-orange-500 underline">
        m.lopz.montn@gmail.com
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Start the dev server (`npm run dev`), visit `http://localhost:3000/support` — confirm it renders
without being signed in and shows English content. Set the `boxbuddy_locale` cookie to `es` (or
switch language via Settings if signed in, then revisit `/support` in a new tab) and confirm the
Spanish version renders.

- [ ] **Step 4: Commit**

```bash
git add app/support/page.tsx
git commit -m "Add support page"
```

---

### Task 2: Privacy Policy page

**Files:**
- Create: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: `getLocale()` (`lib/i18n/server.ts`); `Locale` type (`lib/i18n/types.ts`).
- Produces: nothing consumed by later tasks (Task 4 links to `/privacy` by URL only).

- [ ] **Step 1: Write the page**

Create `app/privacy/page.tsx`:

```tsx
// app/privacy/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

type Section = { heading: string; body: string };

const content: Record<Locale, { title: string; sections: Section[] }> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Overview",
        body: "This Privacy Policy explains what information BoxBuddy collects, how it's used, and your rights regarding that information. BoxBuddy is a small, independently-run inventory tracking service — by using it, you agree to the practices described here.",
      },
      {
        heading: "Information We Collect",
        body: "When you create a BoxBuddy account, we collect your email address and password (managed securely by Supabase Auth — we never see your password in plain text). As you use the app, we store the inventory data you enter: item names, quantities, locations, categories, costs, prices, notes, and any photos you upload. If you subscribe to BoxBuddy Pro, RevenueCat and Stripe process your payment and subscription information; BoxBuddy itself never sees or stores your payment card details.",
      },
      {
        heading: "How We Use Your Information",
        body: "We use this information solely to provide the BoxBuddy service to you: authenticating your account, storing and displaying your inventory, processing subscription payments, and communicating with you about your account when necessary. We do not sell your information to third parties.",
      },
      {
        heading: "Third-Party Services",
        body: "BoxBuddy relies on three third-party services to operate: Supabase (authentication and database hosting), RevenueCat (subscription management), and Stripe (payment processing). Each of these providers has its own privacy policy governing how they handle your data.",
      },
      {
        heading: "Data Retention",
        body: "Your account data is retained for as long as your account exists. If you'd like your account and its data deleted, email us at m.lopz.montn@gmail.com and we'll process the request.",
      },
      {
        heading: "Cookies",
        body: "BoxBuddy uses two cookies: one to keep you signed in (managed by Supabase Auth), and one to remember your chosen language (English or Spanish). Neither is used for advertising or tracking.",
      },
      {
        heading: "Your Rights",
        body: "You may request access to, correction of, or deletion of your personal data at any time by emailing m.lopz.montn@gmail.com.",
      },
      {
        heading: "Changes to This Policy",
        body: "We may update this Privacy Policy from time to time. Continued use of BoxBuddy after changes are posted constitutes acceptance of the updated policy.",
      },
      {
        heading: "Governing Law",
        body: "This Privacy Policy is governed by the laws of Mexico.",
      },
      {
        heading: "Contact",
        body: "Questions about this policy? Email m.lopz.montn@gmail.com.",
      },
    ],
  },
  es: {
    title: "Política de Privacidad",
    sections: [
      {
        heading: "Resumen",
        body: "Esta Política de Privacidad explica qué información recopila BoxBuddy, cómo se usa y cuáles son tus derechos sobre esa información. BoxBuddy es un servicio de seguimiento de inventario pequeño y de gestión independiente — al usarlo, aceptas las prácticas descritas aquí.",
      },
      {
        heading: "Información que recopilamos",
        body: "Cuando creas una cuenta de BoxBuddy, recopilamos tu correo electrónico y contraseña (gestionados de forma segura por Supabase Auth — nunca vemos tu contraseña en texto plano). Mientras usas la app, almacenamos los datos de inventario que ingresas: nombres de artículos, cantidades, ubicaciones, categorías, costos, precios, notas y cualquier foto que subas. Si te suscribes a BoxBuddy Pro, RevenueCat y Stripe procesan tu información de pago y suscripción; BoxBuddy nunca ve ni almacena los datos de tu tarjeta de pago.",
      },
      {
        heading: "Cómo usamos tu información",
        body: "Usamos esta información únicamente para brindarte el servicio de BoxBuddy: autenticar tu cuenta, almacenar y mostrar tu inventario, procesar pagos de suscripción y comunicarnos contigo sobre tu cuenta cuando sea necesario. No vendemos tu información a terceros.",
      },
      {
        heading: "Servicios de terceros",
        body: "BoxBuddy depende de tres servicios de terceros para funcionar: Supabase (autenticación y alojamiento de base de datos), RevenueCat (gestión de suscripciones) y Stripe (procesamiento de pagos). Cada uno de estos proveedores tiene su propia política de privacidad que rige cómo manejan tus datos.",
      },
      {
        heading: "Retención de datos",
        body: "Los datos de tu cuenta se conservan mientras tu cuenta exista. Si deseas que eliminemos tu cuenta y sus datos, escríbenos a m.lopz.montn@gmail.com y procesaremos la solicitud.",
      },
      {
        heading: "Cookies",
        body: "BoxBuddy usa dos cookies: una para mantener tu sesión iniciada (gestionada por Supabase Auth) y otra para recordar el idioma que elegiste (inglés o español). Ninguna se usa para publicidad ni rastreo.",
      },
      {
        heading: "Tus derechos",
        body: "Puedes solicitar acceso, corrección o eliminación de tus datos personales en cualquier momento escribiendo a m.lopz.montn@gmail.com.",
      },
      {
        heading: "Cambios a esta política",
        body: "Podemos actualizar esta Política de Privacidad de vez en cuando. El uso continuado de BoxBuddy después de publicar cambios constituye la aceptación de la política actualizada.",
      },
      {
        heading: "Ley aplicable",
        body: "Esta Política de Privacidad se rige por las leyes de México.",
      },
      {
        heading: "Contacto",
        body: "¿Preguntas sobre esta política? Escribe a m.lopz.montn@gmail.com.",
      },
    ],
  },
};

export default function PrivacyPage() {
  const locale = getLocale();
  const { title, sections } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-stone-800">{section.heading}</h2>
          <p className="text-sm text-stone-600">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Visit `http://localhost:3000/privacy` signed out — confirm all 10 sections render in English, and
again with the `boxbuddy_locale` cookie set to `es` — confirm the Spanish version renders with no
missing sections.

- [ ] **Step 4: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "Add privacy policy page"
```

---

### Task 3: Terms of Service page

**Files:**
- Create: `app/terms/page.tsx`

**Interfaces:**
- Consumes: `getLocale()` (`lib/i18n/server.ts`); `Locale` type (`lib/i18n/types.ts`).
- Produces: nothing consumed by later tasks (Task 4 links to `/terms` by URL only).

- [ ] **Step 1: Write the page**

Create `app/terms/page.tsx`:

```tsx
// app/terms/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

type Section = { heading: string; body: string };

const content: Record<Locale, { title: string; sections: Section[] }> = {
  en: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Acceptance of Terms",
        body: "By creating a BoxBuddy account, you agree to these Terms of Service. If you do not agree, please do not use BoxBuddy.",
      },
      {
        heading: "Your Account",
        body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating your account.",
      },
      {
        heading: "Subscriptions and Billing",
        body: "BoxBuddy offers a free tier (up to 50 items) and paid BoxBuddy Pro tiers (Monthly, Yearly, and Lifetime) with higher or unlimited item limits and barcode label printing. Paid subscriptions are billed and processed through RevenueCat and Stripe, and renew automatically until cancelled. You can manage or cancel your subscription at any time from the Settings page in the app. We do not offer refunds for partial billing periods, except where required by law.",
      },
      {
        heading: "Acceptable Use",
        body: "You agree not to use BoxBuddy for any unlawful purpose, to attempt to access another user's data, or to interfere with the normal operation of the service.",
      },
      {
        heading: "Service Availability",
        body: 'BoxBuddy is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee that the service will be uninterrupted, error-free, or available at all times.',
      },
      {
        heading: "Limitation of Liability",
        body: "To the fullest extent permitted by law, BoxBuddy and its operator are not liable for any indirect, incidental, or consequential damages arising from your use of the service, including loss of data.",
      },
      {
        heading: "Termination",
        body: "We may suspend or terminate your access to BoxBuddy if you violate these Terms. You may stop using BoxBuddy and cancel your subscription at any time.",
      },
      {
        heading: "Changes to These Terms",
        body: "We may update these Terms from time to time. Continued use of BoxBuddy after changes are posted constitutes acceptance of the updated Terms.",
      },
      {
        heading: "Governing Law",
        body: "These Terms are governed by the laws of Mexico.",
      },
      {
        heading: "Contact",
        body: "Questions about these Terms? Email m.lopz.montn@gmail.com.",
      },
    ],
  },
  es: {
    title: "Términos de Servicio",
    sections: [
      {
        heading: "Aceptación de los términos",
        body: "Al crear una cuenta de BoxBuddy, aceptas estos Términos de Servicio. Si no estás de acuerdo, por favor no uses BoxBuddy.",
      },
      {
        heading: "Tu cuenta",
        body: "Eres responsable de mantener la confidencialidad de tus credenciales de cuenta y de toda actividad que ocurra bajo tu cuenta. Debes proporcionar información precisa al crear tu cuenta.",
      },
      {
        heading: "Suscripciones y facturación",
        body: "BoxBuddy ofrece un plan gratuito (hasta 50 artículos) y planes pagados BoxBuddy Pro (Mensual, Anual y De por vida) con límites de artículos más altos o ilimitados e impresión de etiquetas de código de barras. Las suscripciones pagadas se facturan y procesan a través de RevenueCat y Stripe, y se renuevan automáticamente hasta que se cancelen. Puedes administrar o cancelar tu suscripción en cualquier momento desde la página de Configuración en la app. No ofrecemos reembolsos por períodos de facturación parciales, excepto cuando lo exija la ley.",
      },
      {
        heading: "Uso aceptable",
        body: "Aceptas no usar BoxBuddy para ningún propósito ilegal, no intentar acceder a los datos de otro usuario y no interferir con el funcionamiento normal del servicio.",
      },
      {
        heading: "Disponibilidad del servicio",
        body: 'BoxBuddy se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas. No garantizamos que el servicio esté libre de interrupciones o errores, ni que esté disponible en todo momento.',
      },
      {
        heading: "Limitación de responsabilidad",
        body: "En la máxima medida permitida por la ley, BoxBuddy y su operador no son responsables de daños indirectos, incidentales o consecuentes derivados del uso del servicio, incluida la pérdida de datos.",
      },
      {
        heading: "Terminación",
        body: "Podemos suspender o cancelar tu acceso a BoxBuddy si violas estos Términos. Puedes dejar de usar BoxBuddy y cancelar tu suscripción en cualquier momento.",
      },
      {
        heading: "Cambios a estos términos",
        body: "Podemos actualizar estos Términos de vez en cuando. El uso continuado de BoxBuddy después de publicar cambios constituye la aceptación de los Términos actualizados.",
      },
      {
        heading: "Ley aplicable",
        body: "Estos Términos se rigen por las leyes de México.",
      },
      {
        heading: "Contacto",
        body: "¿Preguntas sobre estos Términos? Escribe a m.lopz.montn@gmail.com.",
      },
    ],
  },
};

export default function TermsPage() {
  const locale = getLocale();
  const { title, sections } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-stone-800">{section.heading}</h2>
          <p className="text-sm text-stone-600">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Visit `http://localhost:3000/terms` signed out — confirm all 10 sections render in English, and
again with the `boxbuddy_locale` cookie set to `es` — confirm the Spanish version renders with no
missing sections.

- [ ] **Step 4: Commit**

```bash
git add app/terms/page.tsx
git commit -m "Add terms of service page"
```

---

### Task 4: Link the three pages from login and signup

**Files:**
- Modify: `lib/i18n/en.ts`
- Modify: `lib/i18n/es.ts`
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`

**Interfaces:**
- Consumes: `/support`, `/privacy`, `/terms` routes (Tasks 1–3, already committed) by URL only — no imports from those files.
- Produces: nothing consumed elsewhere — final task.

- [ ] **Step 1: Add the footer link translation keys**

In `lib/i18n/en.ts`, find the last line before the closing `};`:

```ts
  "scan.lookUp": "Look up",
};
```

Replace with:

```ts
  "scan.lookUp": "Look up",

  "footer.support": "Support",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
};
```

In `lib/i18n/es.ts`, find the last line before the closing `};`:

```ts
  "scan.lookUp": "Buscar",
};
```

Replace with:

```ts
  "scan.lookUp": "Buscar",

  "footer.support": "Soporte",
  "footer.privacy": "Política de Privacidad",
  "footer.terms": "Términos de Servicio",
};
```

- [ ] **Step 2: Run the dictionary parity test**

Run: `npm test -- dictionaries`
Expected: PASS — `tests/lib/i18n/dictionaries.test.ts` confirms `en.ts` and `es.ts` still have
identical key sets and no empty values.

- [ ] **Step 3: Add the footer to the login page**

In `app/login/page.tsx`, find:

```tsx
        <div className="flex justify-between text-sm">
          <Link href="/signup" className="text-stone-500 underline">
            {t("signup.signUp")}
          </Link>
          <Link href="/forgot-password" className="text-stone-500 underline">
            {t("login.forgotPasswordLink")}
          </Link>
        </div>
      </form>
    </main>
  );
}
```

Replace with:

```tsx
        <div className="flex justify-between text-sm">
          <Link href="/signup" className="text-stone-500 underline">
            {t("signup.signUp")}
          </Link>
          <Link href="/forgot-password" className="text-stone-500 underline">
            {t("login.forgotPasswordLink")}
          </Link>
        </div>
      </form>
      <div className="flex justify-center gap-3 text-xs text-stone-400">
        <Link href="/support" className="underline">
          {t("footer.support")}
        </Link>
        <Link href="/privacy" className="underline">
          {t("footer.privacy")}
        </Link>
        <Link href="/terms" className="underline">
          {t("footer.terms")}
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add the footer to the signup page**

In `app/signup/page.tsx`, find:

```tsx
        <Link href="/login" className="text-center text-sm text-stone-500 underline">
          {t("signup.alreadyHaveAccount")}
        </Link>
      </form>
    </main>
  );
}
```

Replace with:

```tsx
        <Link href="/login" className="text-center text-sm text-stone-500 underline">
          {t("signup.alreadyHaveAccount")}
        </Link>
      </form>
      <div className="flex justify-center gap-3 text-xs text-stone-400">
        <Link href="/support" className="underline">
          {t("footer.support")}
        </Link>
        <Link href="/privacy" className="underline">
          {t("footer.privacy")}
        </Link>
        <Link href="/terms" className="underline">
          {t("footer.terms")}
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass or skip (no failures).

- [ ] **Step 6: Manual check**

Visit `http://localhost:3000/login` and `http://localhost:3000/signup` — confirm the three footer
links appear below the form, and each navigates to the correct page (`/support`, `/privacy`,
`/terms`) in both English and Spanish.

- [ ] **Step 7: Commit**

```bash
git add lib/i18n/en.ts lib/i18n/es.ts app/login/page.tsx app/signup/page.tsx
git commit -m "Link support/privacy/terms pages from login and signup"
```
