// app/(app)/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

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
    setMessage(error ? error.message : "Password updated.");
    if (!error) setNewPassword("");
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>

      {email && (
        <p className="text-sm text-stone-600">
          Signed in as <span className="font-medium">{email}</span>
        </p>
      )}

      <form onSubmit={handleChangePassword} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">New password</span>
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
          {submitting ? "Saving..." : "Update password"}
        </button>
      </form>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-stone-300 p-3 text-stone-600"
      >
        Log out
      </button>

      <div className="mt-6 flex justify-center">
        <Image src="/illustrations/random-deco.png" alt="" width={160} height={160} />
      </div>
    </main>
  );
}
