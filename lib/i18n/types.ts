// lib/i18n/types.ts
import type { en } from "./en";

export type Locale = "en" | "es";
export type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;
