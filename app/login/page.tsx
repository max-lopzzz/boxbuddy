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
