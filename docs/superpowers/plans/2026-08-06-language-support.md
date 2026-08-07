# Language Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual (English/Spanish) support to BoxBuddy — auto-detected from the browser on
first visit, switchable anytime from Settings, and persisted per-account so it follows a signed-in
user to a new device.

**Architecture:** A flat key→string dictionary per language (`lib/i18n/en.ts`, `lib/i18n/es.ts`),
read server-side via a cookie (`lib/i18n/server.ts`) and client-side via a React Context
(`lib/i18n/client.tsx`). `middleware.ts` auto-detects the language from `Accept-Language` on first
visit. Every page/component with static text is updated to call `t(key)` instead of a hardcoded
string.

**Tech Stack:** Next.js 14 App Router, TypeScript, React Context, Supabase Auth `user_metadata`
(for cross-device persistence). No new npm dependencies.

## Global Constraints

- No new npm dependencies. (Spec: Architecture)
- Server-generated error/validation messages (API route error responses,
  `InvalidItemInputError` messages) are NOT translated — they stay English-only. (Spec: Non-Goals)
- The "BoxBuddy" brand name and the "SKU" field name are NOT translated — identical in both
  languages. (Spec: Non-Goals)
- No locale-prefixed URLs — the URL is identical regardless of language. (Spec: Non-Goals)
- The language cookie is named `boxbuddy_locale`, values are exactly `"en"` or `"es"`. Any other
  value is treated as absent. (Spec: Error Handling)
- Auto-detection only ever runs once per visitor — after the cookie is set (by auto-detection or
  an explicit choice), it's never overwritten by re-detection. (Spec: Architecture)

---

### Task 1: Dictionaries, locale type, and Accept-Language detection

**Files:**
- Create: `lib/i18n/constants.ts`
- Create: `lib/i18n/types.ts`
- Create: `lib/i18n/en.ts`
- Create: `lib/i18n/es.ts`
- Create: `lib/i18n/detect.ts`
- Create: `tests/lib/i18n/detect.test.ts`
- Create: `tests/lib/i18n/dictionaries.test.ts`

**Interfaces:**
- Produces: `LOCALE_COOKIE: string` (`lib/i18n/constants.ts`); `Locale = "en" | "es"`,
  `Dictionary`, `TranslationKey` types (`lib/i18n/types.ts`); `en: Dictionary`, `es: Dictionary`
  (the complete key set every later task references); `detectLocaleFromAcceptLanguage(header:
  string | null): Locale` (`lib/i18n/detect.ts`).

This task is purely additive — no existing file is touched.

- [ ] **Step 1: Create `lib/i18n/constants.ts`**

```ts
// lib/i18n/constants.ts
export const LOCALE_COOKIE = "boxbuddy_locale";
```

- [ ] **Step 2: Create `lib/i18n/types.ts`**

```ts
// lib/i18n/types.ts
import type { en } from "./en";

export type Locale = "en" | "es";
export type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;
```

- [ ] **Step 3: Create `lib/i18n/en.ts`**

```ts
// lib/i18n/en.ts
export const en = {
  "common.email": "Email",
  "common.password": "Password",
  "common.name": "Name",
  "common.quantity": "Quantity",
  "common.location": "Location",
  "common.category": "Category",
  "common.cost": "Cost",
  "common.price": "Price",
  "common.lowStock": "Low stock",
  "common.saving": "Saving…",
  "common.passwordsDoNotMatch": "Passwords do not match",

  "login.invalidOrExpiredLink": "That link is invalid or has expired. Please request a new one.",
  "login.loggingIn": "Logging in…",
  "login.logIn": "Log in",
  "login.forgotPasswordLink": "Forgot password?",

  "signup.confirmPasswordPlaceholder": "Confirm password",
  "signup.signingUp": "Signing up…",
  "signup.signUp": "Sign up",
  "signup.alreadyHaveAccount": "Already have an account? Log in",

  "forgotPassword.resetLinkSentMessage":
    "If an account exists for that email, a reset link has been sent.",
  "forgotPassword.sending": "Sending…",
  "forgotPassword.sendResetLink": "Send reset link",

  "resetPassword.newPasswordPlaceholder": "New password",
  "resetPassword.confirmNewPasswordPlaceholder": "Confirm new password",
  "resetPassword.setNewPassword": "Set new password",

  "appLayout.settingsLink": "Settings",

  "settings.title": "Settings",
  "settings.signedInAs": "Signed in as",
  "settings.newPasswordLabel": "New password",
  "settings.updatePassword": "Update password",
  "settings.passwordUpdated": "Password updated.",
  "settings.logOut": "Log out",
  "settings.language": "Language",
  "settings.languageEnglish": "English",
  "settings.languageSpanish": "Español",

  "dashboard.itemsLabel": "Items",
  "dashboard.costValueLabel": "Cost value",
  "dashboard.couldNotLoadInventory": "Couldn't load your inventory. Please try again.",
  "dashboard.loadingInventory": "Loading your inventory…",
  "dashboard.noItemsYetTitle": "No items yet",
  "dashboard.noItemsYetSubtitle": "Add your first item to get started.",
  "dashboard.addItem": "Add item",
  "dashboard.noMatchesForPrefix": "No matches for",
  "dashboard.scanButton": "Scan",
  "dashboard.searchPlaceholder": "Search by name or SKU",

  "emptyState.greetAlt": "A cat peeking around the corner",
  "emptyState.noResultsAlt": "A sad cat sitting in an empty box",
  "emptyState.loadingAlt": "A cat carrying a box",

  "itemForm.nameHint": "The item's name, as you'd want to see it in your inventory list.",
  "itemForm.namePlaceholder": "e.g. Wireless Mouse",
  "itemForm.skuHint":
    "A barcode that uniquely identifies this item. Scan one, or let the app generate one if it doesn't have one.",
  "itemForm.cancel": "Cancel",
  "itemForm.cameraError": "Couldn't access the camera. Try \"I don't have a barcode\" instead.",
  "itemForm.scanAgain": "Scan again",
  "itemForm.clear": "Clear",
  "itemForm.autoGenerateMessage": "A code will be generated automatically when you save.",
  "itemForm.scanNewBarcode": "Scan this item's new barcode.",
  "itemForm.scanOrGenerateMessage":
    "Scan this item's barcode, or generate one if it doesn't have one.",
  "itemForm.scanBarcode": "Scan barcode",
  "itemForm.noBarcode": "I don't have a barcode",
  "itemForm.reorderAtLabel": "Reorder at",
  "itemForm.reorderAtHint":
    "When quantity drops to this number or below, the item is flagged as low stock.",
  "itemForm.reorderAtPlaceholder": "e.g. 5",
  "itemForm.locationHint": "Where this item is stored, e.g. a shelf or bin name.",
  "itemForm.locationPlaceholder": "e.g. Shelf A",
  "itemForm.categoryHint": "A group to help organize similar items together.",
  "itemForm.categoryPlaceholder": "e.g. Office supplies",
  "itemForm.costHint": "What you paid for this item, per unit.",
  "itemForm.priceHint": "What you sell this item for, per unit.",
  "itemForm.notesLabel": "Notes",
  "itemForm.notesHint": "Anything else worth remembering about this item.",
  "itemForm.notesPlaceholder": "Any extra details…",
  "itemForm.photoLabel": "Photo",
  "itemForm.photoHint": "A picture to help you recognize this item at a glance.",
  "itemForm.photoTooLarge": "Photo must be 5MB or smaller.",
  "itemForm.somethingWentWrong": "Something went wrong",
  "itemForm.photoUploadFailed":
    "The item saved, but the photo upload failed. You can try again below.",
  "itemForm.saveChanges": "Save changes",

  "fieldLabel.infoAbout": "Info about",

  "itemDetail.marginLabel": "Margin",
  "itemDetail.edit": "Edit",

  "deleteItemButton.confirmMessage": "Delete this item? This cannot be undone.",
  "deleteItemButton.deleteFailed": "Couldn't delete this item. Please try again.",
  "deleteItemButton.delete": "Delete",

  "barcodePrintLabel.couldNotDraw": "Couldn't draw a barcode for this code.",
  "barcodePrintLabel.printLabel": "Print label",

  "scan.title": "Scan a code",
  "scan.cameraFailedManual": "Couldn't access the camera. Enter the code manually below.",
  "scan.noItemFoundPrefix": "No item found for code",
  "scan.createNewItemWithCode": "Create new item with this code",
  "scan.cameraNotWorkingSummary": "Camera not working? Enter the code manually.",
  "scan.manualCodePlaceholder": "e.g. bb_x7f2a9",
  "scan.lookUp": "Look up",
} as const;
```

- [ ] **Step 4: Create `lib/i18n/es.ts`**

```ts
// lib/i18n/es.ts
import type { Dictionary } from "./types";

export const es: Dictionary = {
  "common.email": "Correo electrónico",
  "common.password": "Contraseña",
  "common.name": "Nombre",
  "common.quantity": "Cantidad",
  "common.location": "Ubicación",
  "common.category": "Categoría",
  "common.cost": "Costo",
  "common.price": "Precio",
  "common.lowStock": "Stock bajo",
  "common.saving": "Guardando…",
  "common.passwordsDoNotMatch": "Las contraseñas no coinciden",

  "login.invalidOrExpiredLink": "Ese enlace no es válido o ha caducado. Por favor solicita uno nuevo.",
  "login.loggingIn": "Iniciando sesión…",
  "login.logIn": "Iniciar sesión",
  "login.forgotPasswordLink": "¿Olvidaste tu contraseña?",

  "signup.confirmPasswordPlaceholder": "Confirmar contraseña",
  "signup.signingUp": "Registrando…",
  "signup.signUp": "Registrarse",
  "signup.alreadyHaveAccount": "¿Ya tienes una cuenta? Inicia sesión",

  "forgotPassword.resetLinkSentMessage":
    "Si existe una cuenta con ese correo, se ha enviado un enlace para restablecer la contraseña.",
  "forgotPassword.sending": "Enviando…",
  "forgotPassword.sendResetLink": "Enviar enlace de restablecimiento",

  "resetPassword.newPasswordPlaceholder": "Nueva contraseña",
  "resetPassword.confirmNewPasswordPlaceholder": "Confirmar nueva contraseña",
  "resetPassword.setNewPassword": "Establecer nueva contraseña",

  "appLayout.settingsLink": "Configuración",

  "settings.title": "Configuración",
  "settings.signedInAs": "Sesión iniciada como",
  "settings.newPasswordLabel": "Nueva contraseña",
  "settings.updatePassword": "Actualizar contraseña",
  "settings.passwordUpdated": "Contraseña actualizada.",
  "settings.logOut": "Cerrar sesión",
  "settings.language": "Idioma",
  "settings.languageEnglish": "English",
  "settings.languageSpanish": "Español",

  "dashboard.itemsLabel": "Artículos",
  "dashboard.costValueLabel": "Valor de costo",
  "dashboard.couldNotLoadInventory": "No se pudo cargar tu inventario. Por favor intenta de nuevo.",
  "dashboard.loadingInventory": "Cargando tu inventario…",
  "dashboard.noItemsYetTitle": "Aún no hay artículos",
  "dashboard.noItemsYetSubtitle": "Agrega tu primer artículo para empezar.",
  "dashboard.addItem": "Agregar artículo",
  "dashboard.noMatchesForPrefix": "Sin resultados para",
  "dashboard.scanButton": "Escanear",
  "dashboard.searchPlaceholder": "Buscar por nombre o SKU",

  "emptyState.greetAlt": "Un gato mirando por la esquina",
  "emptyState.noResultsAlt": "Un gato triste sentado en una caja vacía",
  "emptyState.loadingAlt": "Un gato cargando una caja",

  "itemForm.nameHint": "El nombre del artículo, como quieres verlo en tu lista de inventario.",
  "itemForm.namePlaceholder": "ej. Mouse inalámbrico",
  "itemForm.skuHint":
    "Un código de barras que identifica este artículo de forma única. Escanea uno, o deja que la app genere uno si no tiene.",
  "itemForm.cancel": "Cancelar",
  "itemForm.cameraError":
    "No se pudo acceder a la cámara. Intenta \"No tengo código de barras\" en su lugar.",
  "itemForm.scanAgain": "Volver a escanear",
  "itemForm.clear": "Borrar",
  "itemForm.autoGenerateMessage": "Se generará un código automáticamente al guardar.",
  "itemForm.scanNewBarcode": "Escanea el nuevo código de barras de este artículo.",
  "itemForm.scanOrGenerateMessage":
    "Escanea el código de barras de este artículo, o genera uno si no tiene.",
  "itemForm.scanBarcode": "Escanear código de barras",
  "itemForm.noBarcode": "No tengo código de barras",
  "itemForm.reorderAtLabel": "Reordenar en",
  "itemForm.reorderAtHint":
    "Cuando la cantidad baje a este número o menos, el artículo se marca como stock bajo.",
  "itemForm.reorderAtPlaceholder": "ej. 5",
  "itemForm.locationHint": "Dónde se guarda este artículo, ej. un estante o contenedor.",
  "itemForm.locationPlaceholder": "ej. Estante A",
  "itemForm.categoryHint": "Un grupo para organizar artículos similares.",
  "itemForm.categoryPlaceholder": "ej. Artículos de oficina",
  "itemForm.costHint": "Lo que pagaste por este artículo, por unidad.",
  "itemForm.priceHint": "Por cuánto vendes este artículo, por unidad.",
  "itemForm.notesLabel": "Notas",
  "itemForm.notesHint": "Cualquier otra cosa que valga la pena recordar sobre este artículo.",
  "itemForm.notesPlaceholder": "Cualquier detalle adicional…",
  "itemForm.photoLabel": "Foto",
  "itemForm.photoHint": "Una foto para reconocer este artículo de un vistazo.",
  "itemForm.photoTooLarge": "La foto debe ser de 5MB o menos.",
  "itemForm.somethingWentWrong": "Algo salió mal",
  "itemForm.photoUploadFailed":
    "El artículo se guardó, pero la foto no se pudo subir. Puedes intentarlo de nuevo abajo.",
  "itemForm.saveChanges": "Guardar cambios",

  "fieldLabel.infoAbout": "Información sobre",

  "itemDetail.marginLabel": "Margen",
  "itemDetail.edit": "Editar",

  "deleteItemButton.confirmMessage": "¿Eliminar este artículo? Esto no se puede deshacer.",
  "deleteItemButton.deleteFailed": "No se pudo eliminar este artículo. Por favor intenta de nuevo.",
  "deleteItemButton.delete": "Eliminar",

  "barcodePrintLabel.couldNotDraw": "No se pudo dibujar un código de barras para este código.",
  "barcodePrintLabel.printLabel": "Imprimir etiqueta",

  "scan.title": "Escanear un código",
  "scan.cameraFailedManual": "No se pudo acceder a la cámara. Ingresa el código manualmente abajo.",
  "scan.noItemFoundPrefix": "No se encontró ningún artículo con el código",
  "scan.createNewItemWithCode": "Crear nuevo artículo con este código",
  "scan.cameraNotWorkingSummary": "¿La cámara no funciona? Ingresa el código manualmente.",
  "scan.manualCodePlaceholder": "ej. bb_x7f2a9",
  "scan.lookUp": "Buscar",
};
```

- [ ] **Step 5: Create `lib/i18n/detect.ts`**

```ts
// lib/i18n/detect.ts
import type { Locale } from "./types";

export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return "en";
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .find((lang) => lang.length > 0);
  if (preferred && preferred.startsWith("es")) return "es";
  return "en";
}
```

- [ ] **Step 6: Write the failing tests**

Create `tests/lib/i18n/detect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectLocaleFromAcceptLanguage } from "../../../lib/i18n/detect";

describe("detectLocaleFromAcceptLanguage", () => {
  it("returns 'en' when the header is null", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
  });

  it("returns 'en' when the header is empty", () => {
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
  });

  it("returns 'es' for a plain 'es' preference", () => {
    expect(detectLocaleFromAcceptLanguage("es")).toBe("es");
  });

  it("returns 'es' for a regional Spanish variant like 'es-MX'", () => {
    expect(detectLocaleFromAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
  });

  it("returns 'en' for English variants", () => {
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("returns 'en' for an unsupported language like French", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("returns 'en' for a header that is only whitespace", () => {
    expect(detectLocaleFromAcceptLanguage("   ")).toBe("en");
  });
});
```

Create `tests/lib/i18n/dictionaries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { en } from "../../../lib/i18n/en";
import { es } from "../../../lib/i18n/es";

describe("i18n dictionaries", () => {
  it("have exactly the same set of keys", () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("have no empty string values in either dictionary", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.length, `en["${key}"] is empty`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(es)) {
      expect(value.length, `es["${key}"] is empty`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/i18n`
Expected: FAIL — `Cannot find module '../../../lib/i18n/detect'` (none of the files exist yet).

- [ ] **Step 8: Implement the files from Steps 1-5 (if not already created) and re-run**

Run: `npx vitest run tests/lib/i18n`
Expected: PASS (9 tests total, all green).

- [ ] **Step 9: Commit**

```bash
git add lib/i18n/constants.ts lib/i18n/types.ts lib/i18n/en.ts lib/i18n/es.ts lib/i18n/detect.ts tests/lib/i18n/detect.test.ts tests/lib/i18n/dictionaries.test.ts
git commit -m "Add i18n dictionaries, locale type, and Accept-Language detection"
```

---

### Task 2: Locale plumbing (server + client) and root layout wiring

**Files:**
- Create: `lib/i18n/server.ts`
- Create: `lib/i18n/client.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `LOCALE_COOKIE` (`lib/i18n/constants.ts`), `Locale`/`Dictionary`/`TranslationKey`
  (`lib/i18n/types.ts`), `en`/`es` (`lib/i18n/en.ts`/`lib/i18n/es.ts`) — all from Task 1.
- Produces: `getLocale(): Locale` and `getDictionary(locale: Locale): Dictionary`
  (`lib/i18n/server.ts`) — for Server Components. `LocaleProvider({ initialLocale, children })`
  and `useTranslation(): { locale: Locale; t: (key: TranslationKey) => string; setLocale: (l:
  Locale) => void }` (`lib/i18n/client.tsx`) — for Client Components.

After this task, every page is wrapped in `LocaleProvider`, but no page yet calls `t()` for its
own copy — that happens in later tasks. The build stays green throughout.

- [ ] **Step 1: Create `lib/i18n/server.ts`**

```ts
// lib/i18n/server.ts
import { cookies } from "next/headers";
import { en } from "./en";
import { es } from "./es";
import { LOCALE_COOKIE } from "./constants";
import type { Locale, Dictionary } from "./types";

export function getLocale(): Locale {
  const raw = cookies().get(LOCALE_COOKIE)?.value;
  return raw === "es" ? "es" : "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "es" ? es : en;
}
```

- [ ] **Step 2: Create `lib/i18n/client.tsx`**

```tsx
// lib/i18n/client.tsx
"use client";

import { createContext, useContext, useState } from "react";
import { en } from "./en";
import { es } from "./es";
import { LOCALE_COOKIE } from "./constants";
import type { Locale, TranslationKey } from "./types";

type LocaleContextValue = {
  locale: Locale;
  t: (key: TranslationKey) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  function setLocale(next: Locale) {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
  }

  function t(key: TranslationKey): string {
    const dict = locale === "es" ? es : en;
    return dict[key];
  }

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslation must be used within a LocaleProvider");
  return ctx;
}
```

- [ ] **Step 3: Update `app/layout.tsx`**

Change:
```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BoxBuddy",
  description: "Small-business inventory tracker",
  manifest: "/manifest.json",
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-orange-50 text-stone-900">{children}</body>
    </html>
  );
}
```
to:
```tsx
import "./globals.css";
import type { Metadata } from "next";
import { getLocale } from "../lib/i18n/server";
import { LocaleProvider } from "../lib/i18n/client";

export const metadata: Metadata = {
  title: "BoxBuddy",
  description: "Small-business inventory tracker",
  manifest: "/manifest.json",
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale}>
      <body className="bg-orange-50 text-stone-900">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, successful build.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/server.ts lib/i18n/client.tsx app/layout.tsx
git commit -m "Add locale server/client plumbing and wire root layout"
```

---

### Task 3: Auto-detect language in middleware

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `LOCALE_COOKIE` (`lib/i18n/constants.ts`), `detectLocaleFromAcceptLanguage` (`lib/i18n/detect.ts`) — both from Task 1.

- [ ] **Step 1: Update `middleware.ts`**

Change the import block:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
```
to:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "./lib/i18n/constants";
import { detectLocaleFromAcceptLanguage } from "./lib/i18n/detect";
```

Change:
```ts
  // Refreshes the session (rewriting cookies if the access token was renewed) so
  // Server Components downstream always see a current session.
  await supabase.auth.getUser();

  return response;
```
to:
```ts
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
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, then in a browser with dev tools open, clear cookies for `localhost:3000` and
reload with the browser's language set to Spanish (or use a private window with the OS/browser
language set to Spanish). Confirm a `boxbuddy_locale=es` cookie appears (Application/Storage tab
in dev tools). Reload with English → confirm `boxbuddy_locale=en`.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "Auto-detect language from Accept-Language on first visit"
```

---

### Task 4: Language switcher in Settings

**Files:**
- Create: `app/api/settings/locale/route.ts`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUserId` (`lib/auth.ts`), `getSupabaseClient` (`lib/supabase.ts`),
  `LOCALE_COOKIE` (`lib/i18n/constants.ts`), `useTranslation` (`lib/i18n/client.tsx`, Task 2).

- [ ] **Step 1: Create `app/api/settings/locale/route.ts`**

```ts
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
```

- [ ] **Step 2: Update `app/(app)/settings/page.tsx`**

Replace the whole file:

```tsx
// app/(app)/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { apiFetch } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n/client";
import type { Locale } from "../../../lib/i18n/types";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { locale, t, setLocale } = useTranslation();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    setMessage(error ? error.message : t("settings.passwordUpdated"));
    if (!error) setNewPassword("");
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleLanguageChange(next: Locale) {
    setLocale(next);
    await apiFetch("/api/settings/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">{t("settings.title")}</h1>

      {email && (
        <p className="text-sm text-stone-600">
          {t("settings.signedInAs")} <span className="font-medium">{email}</span>
        </p>
      )}

      <form onSubmit={handleChangePassword} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">{t("settings.newPasswordLabel")}</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        {message && <p className="text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 text-white disabled:opacity-50"
        >
          {submitting ? t("common.saving") : t("settings.updatePassword")}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-stone-600">{t("settings.language")}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleLanguageChange("en")}
            className={`flex-1 rounded-lg border p-2 text-sm ${
              locale === "en"
                ? "border-orange-400 bg-orange-50 text-stone-800"
                : "border-stone-300 text-stone-600"
            }`}
          >
            {t("settings.languageEnglish")}
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange("es")}
            className={`flex-1 rounded-lg border p-2 text-sm ${
              locale === "es"
                ? "border-orange-400 bg-orange-50 text-stone-800"
                : "border-stone-300 text-stone-600"
            }`}
          >
            {t("settings.languageSpanish")}
          </button>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-stone-300 p-3 text-stone-600"
      >
        {t("settings.logOut")}
      </button>

      <div className="mt-6 flex justify-center">
        <Image src="/illustrations/random-deco.png" alt="" width={160} height={160} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With `npm run dev` running and signed in, open Settings, click "Español" — confirm the button
highlights and (checking Network tab) a `POST /api/settings/locale` request fires and returns
`{ ok: true }`. Reload the page — confirm `boxbuddy_locale=es` cookie persists.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/locale/route.ts "app/(app)/settings/page.tsx"
git commit -m "Add language switcher to Settings"
```

---

### Task 5: Translate pre-auth pages and sync language on login

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`
- Modify: `app/forgot-password/page.tsx`
- Modify: `app/reset-password/page.tsx`

**Interfaces:**
- Consumes: `useTranslation` (`lib/i18n/client.tsx`, Task 2).

- [ ] **Step 1: Update `app/login/page.tsx`**

Replace the whole file:

```tsx
// app/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useTranslation } from "../../lib/i18n/client";
import type { Locale, TranslationKey } from "../../lib/i18n/types";

const URL_ERROR_KEYS: Record<string, TranslationKey> = {
  "invalid-or-expired-link": "login.invalidOrExpiredLink",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const { t, locale, setLocale } = useTranslation();
  const [error, setError] = useState<string | null>(
    urlError && URL_ERROR_KEYS[urlError] ? t(URL_ERROR_KEYS[urlError]) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const savedLocale = data.user?.user_metadata?.locale;
    if ((savedLocale === "en" || savedLocale === "es") && savedLocale !== locale) {
      setLocale(savedLocale as Locale);
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Image src="/illustrations/logo.png" alt="BoxBuddy" width={120} height={120} />
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="email"
          placeholder={t("common.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder={t("common.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? t("login.loggingIn") : t("login.logIn")}
        </button>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Update `app/signup/page.tsx`**

Change:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
```
to:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useTranslation } from "../../lib/i18n/client";
```

Change:
```tsx
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
```
to:
```tsx
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("common.passwordsDoNotMatch"));
      return;
    }
```

Change:
```tsx
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Signing up..." : "Sign up"}
        </button>
        <Link href="/login" className="text-center text-sm text-stone-500 underline">
          Already have an account? Log in
        </Link>
```
to:
```tsx
        <input
          type="email"
          placeholder={t("common.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder={t("common.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        <input
          type="password"
          placeholder={t("signup.confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? t("signup.signingUp") : t("signup.signUp")}
        </button>
        <Link href="/login" className="text-center text-sm text-stone-500 underline">
          {t("signup.alreadyHaveAccount")}
        </Link>
```

- [ ] **Step 3: Update `app/forgot-password/page.tsx`**

Change:
```tsx
import { useState } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Supabase intentionally never reveals whether the email has an account —
    // always show the same message regardless of the actual result.
    setMessage("If an account exists for that email, a reset link has been sent.");
  }
```
to:
```tsx
import { useState } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useTranslation } from "../../lib/i18n/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Supabase intentionally never reveals whether the email has an account —
    // always show the same message regardless of the actual result.
    setMessage(t("forgotPassword.resetLinkSentMessage"));
  }
```

Change:
```tsx
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        {message && <p className="text-center text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
```
to:
```tsx
        <input
          type="email"
          placeholder={t("common.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        {message && <p className="text-center text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? t("forgotPassword.sending") : t("forgotPassword.sendResetLink")}
        </button>
```

- [ ] **Step 4: Update `app/reset-password/page.tsx`**

Change:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
```
to:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useTranslation } from "../../lib/i18n/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("common.passwordsDoNotMatch"));
      return;
    }
```

Change:
```tsx
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Set new password"}
        </button>
```
to:
```tsx
        <input
          type="password"
          placeholder={t("resetPassword.newPasswordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
          autoFocus
        />
        <input
          type="password"
          placeholder={t("resetPassword.confirmNewPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? t("common.saving") : t("resetPassword.setNewPassword")}
        </button>
```

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx app/forgot-password/page.tsx app/reset-password/page.tsx
git commit -m "Translate pre-auth pages and sync saved language on login"
```

---

### Task 6: Translate the dashboard, app header, and search

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/page.tsx`
- Modify: `components/ItemCard.tsx`
- Modify: `components/SearchBar.tsx`
- Modify: `components/EmptyState.tsx`

**Interfaces:**
- Consumes: `useTranslation` (`lib/i18n/client.tsx`, Task 2).

- [ ] **Step 1: Update `app/(app)/layout.tsx`**

This layout is a Server Component (it's `async` and calls `redirect`), so it uses `getDictionary`/
`getLocale` rather than the client hook. Change:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/signup");
  }
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3">
        <Link href="/" className="font-semibold text-stone-800">
          BoxBuddy
        </Link>
        <Link href="/settings" className="text-sm text-stone-500 underline">
          Settings
        </Link>
      </header>
      {children}
    </>
  );
}
```
to:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../lib/auth";
import { getLocale, getDictionary } from "../../lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/signup");
  }
  const dict = getDictionary(getLocale());
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3">
        <Link href="/" className="font-semibold text-stone-800">
          BoxBuddy
        </Link>
        <Link href="/settings" className="text-sm text-stone-500 underline">
          {dict["appLayout.settingsLink"]}
        </Link>
      </header>
      {children}
    </>
  );
}
```

- [ ] **Step 2: Update `app/(app)/page.tsx`**

Replace the whole file:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ItemCard } from "../../components/ItemCard";
import { SearchBar } from "../../components/SearchBar";
import { EmptyState } from "../../components/EmptyState";
import { isLowStock } from "../../lib/item-helpers";
import { apiFetch } from "../../lib/api-client";
import { useTranslation } from "../../lib/i18n/client";
import type { Item } from "../../lib/types";

export default function DashboardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [search, setSearch] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchItems = useCallback(
    async (query: string) => {
      setItems(null);
      setFetchError(null);
      const url = query ? `/api/items?search=${encodeURIComponent(query)}` : "/api/items";
      try {
        const res = await apiFetch(url);
        if (!res.ok) {
          setFetchError(t("dashboard.couldNotLoadInventory"));
          setItems([]);
          return;
        }
        const body = await res.json();
        setItems(body.items ?? []);
      } catch {
        setFetchError(t("dashboard.couldNotLoadInventory"));
        setItems([]);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchItems(search);
  }, [search, fetchItems]);

  const totalCostValue = items?.reduce((sum, i) => sum + (i.cost ?? 0) * i.quantity, 0) ?? 0;
  const lowStockCount = items?.filter((i) => isLowStock(i.quantity, i.reorder_at)).length ?? 0;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      {fetchError && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{fetchError}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={t("dashboard.itemsLabel")} value={items?.length ?? "…"} />
        <SummaryCard label={t("dashboard.costValueLabel")} value={`$${totalCostValue.toFixed(2)}`} />
        <SummaryCard label={t("common.lowStock")} value={lowStockCount} />
      </div>

      <SearchBar onSearch={setSearch} />

      {items === null && (
        <EmptyState illustration="loading" title={t("dashboard.loadingInventory")} />
      )}

      {items !== null && items.length === 0 && search === "" && (
        <EmptyState
          illustration="greet"
          title={t("dashboard.noItemsYetTitle")}
          subtitle={t("dashboard.noItemsYetSubtitle")}
          action={
            <Link href="/items/new" className="rounded-lg bg-orange-400 px-4 py-2 text-white">
              {t("dashboard.addItem")}
            </Link>
          }
        />
      )}

      {items !== null && items.length === 0 && search !== "" && (
        <EmptyState
          illustration="no-results"
          title={`${t("dashboard.noMatchesForPrefix")} "${search}"`}
        />
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
        <Link href="/scan" className="rounded-full bg-stone-800 px-5 py-3 text-white shadow-lg">
          {t("dashboard.scanButton")}
        </Link>
        <Link href="/items/new" className="rounded-full bg-orange-400 px-5 py-3 text-white shadow-lg">
          {t("dashboard.addItem")}
        </Link>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-orange-50 p-3 text-center">
      <p className="text-lg font-semibold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
```

- [ ] **Step 3: Update `components/ItemCard.tsx`**

Change:
```tsx
// components/ItemCard.tsx
import Link from "next/link";
import type { Item } from "../lib/types";
import { isLowStock } from "../lib/item-helpers";

export function ItemCard({ item }: { item: Item }) {
  const low = isLowStock(item.quantity, item.reorder_at);
```
to:
```tsx
// components/ItemCard.tsx
"use client";

import Link from "next/link";
import type { Item } from "../lib/types";
import { isLowStock } from "../lib/item-helpers";
import { useTranslation } from "../lib/i18n/client";

export function ItemCard({ item }: { item: Item }) {
  const low = isLowStock(item.quantity, item.reorder_at);
  const { t } = useTranslation();
```

Change:
```tsx
      {low && (
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          <span aria-hidden="true">⚠️</span>
          Low stock
        </span>
      )}
```
to:
```tsx
      {low && (
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          <span aria-hidden="true">⚠️</span>
          {t("common.lowStock")}
        </span>
      )}
```

`ItemCard` becomes a Client Component (it was a plain function component before, with no
`"use client"` directive, but it was already only ever rendered from Client Component pages —
`app/(app)/page.tsx` — so this doesn't change where it can be used).

- [ ] **Step 4: Update `components/SearchBar.tsx`**

Change:
```tsx
// components/SearchBar.tsx
"use client";

import { useEffect, useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timeout);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      placeholder="Search by name or SKU"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-orange-200 p-3"
    />
  );
}
```
to:
```tsx
// components/SearchBar.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "../lib/i18n/client";

export function SearchBar({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    const timeout = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timeout);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      placeholder={t("dashboard.searchPlaceholder")}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-orange-200 p-3"
    />
  );
}
```

- [ ] **Step 5: Update `components/EmptyState.tsx`**

The illustration `alt` text is static English content the spec requires translating. Since the
component gains a hook, it also needs `"use client"` (its only consumer, the dashboard page, is
already a Client Component, so this doesn't change where it can be used). Change:
```tsx
import Image from "next/image";

const ILLUSTRATIONS = {
  greet: { src: "/illustrations/greet.png", alt: "A cat peeking around the corner" },
  "no-results": { src: "/illustrations/no-results.png", alt: "A sad cat sitting in an empty box" },
  loading: { src: "/illustrations/loading.png", alt: "A cat carrying a box" },
} as const;

export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { src, alt } = ILLUSTRATIONS[illustration];
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <Image src={src} alt={alt} width={200} height={200} />
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      {action}
    </div>
  );
}
```
to:
```tsx
"use client";

import Image from "next/image";
import { useTranslation } from "../lib/i18n/client";
import type { TranslationKey } from "../lib/i18n/types";

const ILLUSTRATION_SRC = {
  greet: "/illustrations/greet.png",
  "no-results": "/illustrations/no-results.png",
  loading: "/illustrations/loading.png",
} as const;

const ILLUSTRATION_ALT_KEY: Record<keyof typeof ILLUSTRATION_SRC, TranslationKey> = {
  greet: "emptyState.greetAlt",
  "no-results": "emptyState.noResultsAlt",
  loading: "emptyState.loadingAlt",
};

export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: keyof typeof ILLUSTRATION_SRC;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <Image
        src={ILLUSTRATION_SRC[illustration]}
        alt={t(ILLUSTRATION_ALT_KEY[illustration])}
        width={200}
        height={200}
      />
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/page.tsx" components/ItemCard.tsx components/SearchBar.tsx components/EmptyState.tsx
git commit -m "Translate dashboard, app header, search, and empty-state illustrations"
```

---

### Task 7: Translate the item form

**Files:**
- Modify: `components/ItemForm.tsx`
- Modify: `components/FieldLabel.tsx`

**Interfaces:**
- Consumes: `useTranslation` (`lib/i18n/client.tsx`, Task 2).
- Produces: `FieldLabel`'s rendered `aria-label` now reads `"{t('fieldLabel.infoAbout')} {label}"`
  instead of `"Info about {label}"` — no prop signature change, callers are unaffected.

- [ ] **Step 1: Update `components/FieldLabel.tsx`**

Change:
```tsx
// components/FieldLabel.tsx
"use client";

import { useState } from "react";

export function FieldLabel({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="flex items-center gap-1">
        <span className="text-sm text-stone-600">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          aria-label={`Info about ${label}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-300 text-[10px] leading-none text-stone-500"
        >
          i
        </button>
      </span>
      {open && <span className="text-xs text-stone-500">{hint}</span>}
    </>
  );
}
```
to:
```tsx
// components/FieldLabel.tsx
"use client";

import { useState } from "react";
import { useTranslation } from "../lib/i18n/client";

export function FieldLabel({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <span className="flex items-center gap-1">
        <span className="text-sm text-stone-600">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          aria-label={`${t("fieldLabel.infoAbout")} ${label}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-300 text-[10px] leading-none text-stone-500"
        >
          i
        </button>
      </span>
      {open && <span className="text-xs text-stone-500">{hint}</span>}
    </>
  );
}
```

- [ ] **Step 2: Update `components/ItemForm.tsx`**

Change the import block and the `handlePhotoChange`/`handleSubmit` bodies. Change:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";
import { FieldLabel } from "./FieldLabel";
```
to:
```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";
import { FieldLabel } from "./FieldLabel";
import { useTranslation } from "../lib/i18n/client";
```

Change:
```tsx
export function ItemForm({ item, prefillCode }: { item?: Item; prefillCode?: string }) {
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item, prefillCode));
  const [skuMode, setSkuMode] = useState<SkuMode>(item?.sku || prefillCode ? "filled" : "empty");
  const [scanError, setScanError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
  const router = useRouter();

  function update<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be 5MB or smaller.");
      setPhotoFile(null);
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  }
```
to:
```tsx
export function ItemForm({ item, prefillCode }: { item?: Item; prefillCode?: string }) {
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item, prefillCode));
  const [skuMode, setSkuMode] = useState<SkuMode>(item?.sku || prefillCode ? "filled" : "empty");
  const [scanError, setScanError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
  const router = useRouter();
  const { t } = useTranslation();

  function update<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setPhotoError(t("itemForm.photoTooLarge"));
      setPhotoFile(null);
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  }
```

Change:
```tsx
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }
```
to:
```tsx
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? t("itemForm.somethingWentWrong"));
      setSubmitting(false);
      return;
    }
```

Change:
```tsx
      if (!photoRes.ok) {
        const photoBody = await photoRes.json().catch(() => ({}));
        setError(photoBody.error ?? "The item saved, but the photo upload failed. You can try again below.");
        setSubmitting(false);
        return;
      }
```
to:
```tsx
      if (!photoRes.ok) {
        const photoBody = await photoRes.json().catch(() => ({}));
        setError(photoBody.error ?? t("itemForm.photoUploadFailed"));
        setSubmitting(false);
        return;
      }
```

Now replace the entire `return (...)` JSX block. Change:
```tsx
  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <FieldLabel label="Name" hint="The item's name, as you'd want to see it in your inventory list." />
        <input
          required
          placeholder="e.g. Wireless Mouse"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
        />
      </label>

      <div className="flex flex-col gap-1">
        <FieldLabel
          label="SKU"
          hint="A barcode that uniquely identifies this item. Scan one, or let the app generate one if it doesn't have one."
        />
        {skuMode === "scanning" ? (
          <div className="flex flex-col gap-2">
            <BarcodeScanner
              onScan={handleScan}
              onCameraError={() => setScanError(true)}
              formatsToSupport={[
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]}
            />
            <button
              type="button"
              onClick={() => setSkuMode(values.sku ? "filled" : "empty")}
              className="text-sm text-stone-500 underline"
            >
              Cancel
            </button>
            {scanError && (
              <p className="text-sm text-red-600">
                Couldn&apos;t access the camera. Try &quot;I don&apos;t have a barcode&quot;
                instead.
              </p>
            )}
          </div>
        ) : values.sku ? (
          <div className="flex items-center justify-between rounded-lg border border-orange-200 p-2">
            <span className="text-stone-800">{values.sku}</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="text-sm text-orange-500 underline"
              >
                Scan again
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => {
                    update("sku", "");
                    setSkuMode("empty");
                  }}
                  className="text-sm text-stone-500 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-500">
              {skuMode === "auto"
                ? "A code will be generated automatically when you save."
                : savedItemState
                  ? "Scan this item's new barcode."
                  : "Scan this item's barcode, or generate one if it doesn't have one."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="flex-1 rounded-lg border border-orange-300 p-2 text-sm text-stone-700"
              >
                Scan barcode
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => setSkuMode("auto")}
                  className="flex-1 rounded-lg border border-stone-300 p-2 text-sm text-stone-700"
                >
                  I don&apos;t have a barcode
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label="Quantity" hint="How many of this item you currently have in stock." />
          <input
            type="number"
            placeholder="0"
            value={values.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel
            label="Reorder at"
            hint="When quantity drops to this number or below, the item is flagged as low stock."
          />
          <input
            type="number"
            placeholder="e.g. 5"
            value={values.reorder_at}
            onChange={(e) => update("reorder_at", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
      </div>

      <AutocompleteInput
        label="Location"
        hint="Where this item is stored, e.g. a shelf or bin name."
        placeholder="e.g. Shelf A"
        field="location"
        value={values.location}
        onChange={(v) => update("location", v)}
      />
      <AutocompleteInput
        label="Category"
        hint="A group to help organize similar items together."
        placeholder="e.g. Office supplies"
        field="category"
        value={values.category}
        onChange={(v) => update("category", v)}
      />

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label="Cost" hint="What you paid for this item, per unit." />
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={values.cost}
            onChange={(e) => update("cost", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label="Price" hint="What you sell this item for, per unit." />
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <FieldLabel label="Notes" hint="Anything else worth remembering about this item." />
        <textarea
          placeholder="Any extra details…"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-1">
        <FieldLabel label="Photo" hint="A picture to help you recognize this item at a glance." />
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
        {photoError && <span className="text-sm text-red-600">{photoError}</span>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : savedItemState ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
```
to:
```tsx
  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <FieldLabel label={t("common.name")} hint={t("itemForm.nameHint")} />
        <input
          required
          placeholder={t("itemForm.namePlaceholder")}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
        />
      </label>

      <div className="flex flex-col gap-1">
        <FieldLabel label="SKU" hint={t("itemForm.skuHint")} />
        {skuMode === "scanning" ? (
          <div className="flex flex-col gap-2">
            <BarcodeScanner
              onScan={handleScan}
              onCameraError={() => setScanError(true)}
              formatsToSupport={[
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]}
            />
            <button
              type="button"
              onClick={() => setSkuMode(values.sku ? "filled" : "empty")}
              className="text-sm text-stone-500 underline"
            >
              {t("itemForm.cancel")}
            </button>
            {scanError && <p className="text-sm text-red-600">{t("itemForm.cameraError")}</p>}
          </div>
        ) : values.sku ? (
          <div className="flex items-center justify-between rounded-lg border border-orange-200 p-2">
            <span className="text-stone-800">{values.sku}</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="text-sm text-orange-500 underline"
              >
                {t("itemForm.scanAgain")}
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => {
                    update("sku", "");
                    setSkuMode("empty");
                  }}
                  className="text-sm text-stone-500 underline"
                >
                  {t("itemForm.clear")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-500">
              {skuMode === "auto"
                ? t("itemForm.autoGenerateMessage")
                : savedItemState
                  ? t("itemForm.scanNewBarcode")
                  : t("itemForm.scanOrGenerateMessage")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="flex-1 rounded-lg border border-orange-300 p-2 text-sm text-stone-700"
              >
                {t("itemForm.scanBarcode")}
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => setSkuMode("auto")}
                  className="flex-1 rounded-lg border border-stone-300 p-2 text-sm text-stone-700"
                >
                  {t("itemForm.noBarcode")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label={t("common.quantity")} hint={t("itemForm.reorderAtHint")} />
          <input
            type="number"
            placeholder="0"
            value={values.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label={t("itemForm.reorderAtLabel")} hint={t("itemForm.reorderAtHint")} />
          <input
            type="number"
            placeholder={t("itemForm.reorderAtPlaceholder")}
            value={values.reorder_at}
            onChange={(e) => update("reorder_at", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
      </div>

      <AutocompleteInput
        label={t("common.location")}
        hint={t("itemForm.locationHint")}
        placeholder={t("itemForm.locationPlaceholder")}
        field="location"
        value={values.location}
        onChange={(v) => update("location", v)}
      />
      <AutocompleteInput
        label={t("common.category")}
        hint={t("itemForm.categoryHint")}
        placeholder={t("itemForm.categoryPlaceholder")}
        field="category"
        value={values.category}
        onChange={(v) => update("category", v)}
      />

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label={t("common.cost")} hint={t("itemForm.costHint")} />
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={values.cost}
            onChange={(e) => update("cost", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel label={t("common.price")} hint={t("itemForm.priceHint")} />
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            className="w-full min-w-0 rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <FieldLabel label={t("itemForm.notesLabel")} hint={t("itemForm.notesHint")} />
        <textarea
          placeholder={t("itemForm.notesPlaceholder")}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-1">
        <FieldLabel label={t("itemForm.photoLabel")} hint={t("itemForm.photoHint")} />
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
        {photoError && <span className="text-sm text-red-600">{photoError}</span>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
        {submitting
          ? t("common.saving")
          : savedItemState
            ? t("itemForm.saveChanges")
            : t("dashboard.addItem")}
      </button>
    </form>
  );
}
```

Note the Quantity field's `FieldLabel` reuses `itemForm.reorderAtHint` — this is a copy-paste bug
carried over unmodified from the pre-i18n version, where BOTH the Quantity and Reorder-at fields
displayed the "When quantity drops to this number or below…" hint due to an unrelated existing
bug. **Do not fix this here** — it's out of scope for this task (translation only, no behavior
changes) and not something this plan was asked to address. Just translate the string that's
already there. If you want to flag it, note it in your report as a concern, but leave the code as
specified above — carrying over the existing (buggy) behavior faithfully in both languages is the
correct scope for this task.

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With `npm run dev` running, open the item form in Spanish (switch language in Settings first, or
set the cookie manually) and confirm every label, hint, placeholder, and button shows Spanish
text.

- [ ] **Step 5: Commit**

```bash
git add components/ItemForm.tsx components/FieldLabel.tsx
git commit -m "Translate the item form"
```

---

### Task 8: Translate the item detail page and its buttons

**Files:**
- Modify: `app/(app)/items/[id]/page.tsx`
- Modify: `components/DeleteItemButton.tsx`
- Modify: `components/BarcodePrintLabel.tsx`

**Interfaces:**
- Consumes: `getLocale`/`getDictionary` (`lib/i18n/server.ts`, Task 2) for the Server Component
  page; `useTranslation` (`lib/i18n/client.tsx`, Task 2) for the two Client Components.

- [ ] **Step 1: Update `app/(app)/items/[id]/page.tsx`**

Change:
```tsx
// app/(app)/items/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { renderBarcodeSvg } from "../../../../lib/barcode";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { BarcodePrintLabel } from "../../../../components/BarcodePrintLabel";
import { DeleteItemButton } from "../../../../components/DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
  if (!item) notFound();

  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const barcodeSvg = renderBarcodeSvg(item.sku);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/items/${item.id}/photo`}
          alt={item.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-xl font-semibold text-stone-800">{item.name}</h1>
      {low && (
        <span className="w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          Low stock
        </span>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="SKU" value={item.sku} />
        <Field label="Quantity" value={String(item.quantity)} />
        <Field label="Location" value={item.location ?? "—"} />
        <Field label="Category" value={item.category ?? "—"} />
        <Field label="Cost" value={item.cost !== null ? `$${item.cost.toFixed(2)}` : "—"} />
        <Field label="Price" value={item.price !== null ? `$${item.price.toFixed(2)}` : "—"} />
        <Field label="Margin" value={margin !== null ? `$${margin.toFixed(2)}` : "—"} />
      </dl>

      {item.notes && <p className="text-sm text-stone-600">{item.notes}</p>}

      <BarcodePrintLabel svg={barcodeSvg} name={item.name} sku={item.sku} />

      <div className="flex gap-2">
        <Link
          href={`/items/${item.id}/edit`}
          className="flex-1 rounded-lg border border-orange-300 p-3 text-center"
        >
          Edit
        </Link>
        <DeleteItemButton itemId={item.id} />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
```
to:
```tsx
// app/(app)/items/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { renderBarcodeSvg } from "../../../../lib/barcode";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { getLocale, getDictionary } from "../../../../lib/i18n/server";
import { BarcodePrintLabel } from "../../../../components/BarcodePrintLabel";
import { DeleteItemButton } from "../../../../components/DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
  if (!item) notFound();

  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const barcodeSvg = renderBarcodeSvg(item.sku);
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/items/${item.id}/photo`}
          alt={item.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-xl font-semibold text-stone-800">{item.name}</h1>
      {low && (
        <span className="w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          {dict["common.lowStock"]}
        </span>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="SKU" value={item.sku} />
        <Field label={dict["common.quantity"]} value={String(item.quantity)} />
        <Field label={dict["common.location"]} value={item.location ?? "—"} />
        <Field label={dict["common.category"]} value={item.category ?? "—"} />
        <Field
          label={dict["common.cost"]}
          value={item.cost !== null ? `$${item.cost.toFixed(2)}` : "—"}
        />
        <Field
          label={dict["common.price"]}
          value={item.price !== null ? `$${item.price.toFixed(2)}` : "—"}
        />
        <Field
          label={dict["itemDetail.marginLabel"]}
          value={margin !== null ? `$${margin.toFixed(2)}` : "—"}
        />
      </dl>

      {item.notes && <p className="text-sm text-stone-600">{item.notes}</p>}

      <BarcodePrintLabel svg={barcodeSvg} name={item.name} sku={item.sku} />

      <div className="flex gap-2">
        <Link
          href={`/items/${item.id}/edit`}
          className="flex-1 rounded-lg border border-orange-300 p-3 text-center"
        >
          {dict["itemDetail.edit"]}
        </Link>
        <DeleteItemButton itemId={item.id} />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Update `components/DeleteItemButton.tsx`**

Change:
```tsx
// components/DeleteItemButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api-client";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setError(null);
    const res = await apiFetch(`/api/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete this item. Please try again.");
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <div className="flex-1">
      <button
        onClick={handleDelete}
        className="w-full rounded-lg border border-red-300 p-3 text-center text-red-600"
      >
        Delete
      </button>
      {error && <p className="mt-1 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
```
to:
```tsx
// components/DeleteItemButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api-client";
import { useTranslation } from "../lib/i18n/client";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  async function handleDelete() {
    if (!confirm(t("deleteItemButton.confirmMessage"))) return;
    setError(null);
    const res = await apiFetch(`/api/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(t("deleteItemButton.deleteFailed"));
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <div className="flex-1">
      <button
        onClick={handleDelete}
        className="w-full rounded-lg border border-red-300 p-3 text-center text-red-600"
      >
        {t("deleteItemButton.delete")}
      </button>
      {error && <p className="mt-1 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Update `components/BarcodePrintLabel.tsx`**

Change:
```tsx
// components/BarcodePrintLabel.tsx
"use client";

export function BarcodePrintLabel({
  svg,
  name,
  sku,
}: {
  svg: string | null;
  name: string;
  sku: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 p-4 print:border-none">
      {svg ? (
        <div
          className="h-20 w-full max-w-xs [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-sm text-red-600">Couldn&apos;t draw a barcode for this code.</p>
      )}
      <p className="text-sm font-medium text-stone-800">{name}</p>
      <p className="text-xs text-stone-500">{sku}</p>
      <button
        onClick={() => window.print()}
        className="mt-2 text-sm text-orange-500 underline print:hidden"
      >
        Print label
      </button>
    </div>
  );
}
```
to:
```tsx
// components/BarcodePrintLabel.tsx
"use client";

import { useTranslation } from "../lib/i18n/client";

export function BarcodePrintLabel({
  svg,
  name,
  sku,
}: {
  svg: string | null;
  name: string;
  sku: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 p-4 print:border-none">
      {svg ? (
        <div
          className="h-20 w-full max-w-xs [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-sm text-red-600">{t("barcodePrintLabel.couldNotDraw")}</p>
      )}
      <p className="text-sm font-medium text-stone-800">{name}</p>
      <p className="text-xs text-stone-500">{sku}</p>
      <button
        onClick={() => window.print()}
        className="mt-2 text-sm text-orange-500 underline print:hidden"
      >
        {t("barcodePrintLabel.printLabel")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/items/[id]/page.tsx" components/DeleteItemButton.tsx components/BarcodePrintLabel.tsx
git commit -m "Translate item detail page, delete button, and print label"
```

---

### Task 9: Translate the scan page

**Files:**
- Modify: `app/(app)/scan/page.tsx`

**Interfaces:**
- Consumes: `useTranslation` (`lib/i18n/client.tsx`, Task 2).

- [ ] **Step 1: Update `app/(app)/scan/page.tsx`**

Replace the whole file:

```tsx
// app/(app)/scan/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "../../../components/BarcodeScanner";
import { apiFetch } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n/client";

export default function ScanPage() {
  const [manualCode, setManualCode] = useState("");
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const handleScan = useCallback(
    async (code: string) => {
      const res = await apiFetch(`/api/items/lookup-by-code?code=${encodeURIComponent(code)}`);
      const body = await res.json();
      if (body.item) {
        router.push(`/items/${body.item.id}`);
      } else {
        setNotFoundCode(code);
      }
    },
    [router]
  );

  const handleCameraError = useCallback(() => {
    setCameraFailed(true);
  }, []);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">{t("scan.title")}</h1>

      {!cameraFailed && <BarcodeScanner onScan={handleScan} onCameraError={handleCameraError} />}

      {cameraFailed && <p className="text-sm text-stone-600">{t("scan.cameraFailedManual")}</p>}

      {notFoundCode && (
        <div className="rounded-lg bg-orange-50 p-3 text-center">
          <p className="text-sm text-stone-600">
            {t("scan.noItemFoundPrefix")} “{notFoundCode}”.
          </p>
          <button
            onClick={() => router.push(`/items/new?code=${encodeURIComponent(notFoundCode)}`)}
            className="mt-2 rounded-lg bg-orange-400 px-4 py-2 text-white"
          >
            {t("scan.createNewItemWithCode")}
          </button>
        </div>
      )}

      <details className="text-sm text-stone-500" open={cameraFailed}>
        <summary>{t("scan.cameraNotWorkingSummary")}</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan(manualCode);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-lg border border-orange-200 p-2"
            placeholder={t("scan.manualCodePlaceholder")}
          />
          <button type="submit" className="rounded-lg bg-stone-800 px-3 py-2 text-white">
            {t("scan.lookUp")}
          </button>
        </form>
      </details>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/scan/page.tsx"
git commit -m "Translate the scan page"
```

---

### Task 10: Final cleanup and manual verification

**Files:**
- None (verification only).

- [ ] **Step 1: Grep for hardcoded English text left in translated files**

Run:
```bash
grep -rn 'placeholder="[A-Za-z]' app components 2>/dev/null
```
Expected: no matches other than intentionally-untranslated ones — cross-check any hit against
this plan's Non-Goals (e.g. barcode format examples like `bb_x7f2a9` are fine; a literal English
sentence in a `placeholder="..."` attribute is not).

- [ ] **Step 2: Full build and test run**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: no type errors, a successful production build, and all non-integration tests passing
(81+9=90 passing: the pre-existing 81 plus this plan's 9 new i18n tests; integration suites still
skip without Supabase env vars, unchanged from before).

- [ ] **Step 3: Manual verification**

With `npm run dev` running and a real Supabase project configured:

1. Clear cookies, set the browser's language to Spanish, and open the app — confirm the
   login/signup page renders in Spanish.
2. Sign up, and confirm the dashboard, item form, item detail, and scan pages are all in Spanish.
3. In Settings, switch to English — confirm every page immediately switches without a reload.
4. Reload the page — confirm it's still English (the cookie persisted).
5. Log out and back in — confirm it's still English (the account's saved preference persisted via
   `user_metadata`).
6. Open a private/incognito window (simulating a new device) with the browser's language set to
   English, and log into the SAME account that just chose English — confirm the app opens in
   English (not re-detected from that window's own language, though in this case they happen to
   match — the important check is that `user_metadata.locale` is what decided it, which you can
   confirm by checking the account's `user_metadata` in the Supabase dashboard under
   Authentication → Users).

- [ ] **Step 4: Commit (if Step 1 found anything to fix)**

Only run this if Step 1 required a fix:
```bash
git add -A
git commit -m "Fix remaining hardcoded English text"
```
