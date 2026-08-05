// app/forgot-password/page.tsx
"use client";

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
        {message && <p className="text-center text-sm text-stone-600">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </main>
  );
}
