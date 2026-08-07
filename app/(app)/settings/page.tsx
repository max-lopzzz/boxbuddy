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
    router.refresh();
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
