// components/DeleteItemButton.tsx
"use client";

import { useRouter } from "next/navigation";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <button
      onClick={handleDelete}
      className="flex-1 rounded-lg border border-red-300 p-3 text-center text-red-600"
    >
      Delete
    </button>
  );
}
