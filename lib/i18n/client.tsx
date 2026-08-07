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
