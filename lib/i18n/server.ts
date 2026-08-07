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
