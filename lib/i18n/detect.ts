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
