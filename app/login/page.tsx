// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const URL_ERROR_MESSAGES: Record<string, string> = {
  "invalid-or-expired-link": "That link is invalid or has expired. Please request a new one.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    urlError ? URL_ERROR_MESSAGES[urlError] ?? null : null
  );
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
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
          className="rounded-lg border border-orange-300 p-3"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <div className="flex justify-between text-sm">
          <Link href="/signup" className="text-stone-500 underline">
            Sign up
          </Link>
          <Link href="/forgot-password" className="text-stone-500 underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </main>
  );
}
