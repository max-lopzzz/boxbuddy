// components/DeleteItemButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api-client";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setError(null);
    const res = await apiFetch(`/api/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete this item. Please try again.");
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <div className="flex-1">
      <button
        onClick={handleDelete}
        className="w-full rounded-lg border border-red-300 p-3 text-center text-red-600"
      >
        Delete
      </button>
      {error && <p className="mt-1 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
