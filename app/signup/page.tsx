// app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useTranslation } from "../../lib/i18n/client";

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
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
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
      </form>
    </main>
  );
}
