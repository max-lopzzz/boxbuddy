// app/(app)/settings/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleChangePasscode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/change-passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const body = await res.json();
    setMessage(res.ok ? "Passcode updated." : body.error ?? "Could not update passcode.");
    if (res.ok) {
      setCurrent("");
      setNext("");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-stone-800">Settings</h1>

      <form onSubmit={handleChangePasscode} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">Current passcode</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">New passcode</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        {message && <p className="text-sm text-stone-600">{message}</p>}
        <button type="submit" className="rounded-lg bg-orange-400 p-3 text-white">
          Update passcode
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
