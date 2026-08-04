// components/ItemCard.tsx
import Link from "next/link";
import type { Item } from "../lib/types";
import { isLowStock } from "../lib/item-helpers";

export function ItemCard({ item }: { item: Item }) {
  const low = isLowStock(item.quantity, item.reorder_at);
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex items-center gap-3 rounded-xl border border-orange-100 bg-white p-3 shadow-sm"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-orange-50 text-2xl">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/items/${item.id}/photo`}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          "📦"
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-stone-800">{item.name}</p>
        <p className="text-sm text-stone-500">
          Qty {item.quantity}
          {item.location ? ` · ${item.location}` : ""}
        </p>
      </div>
      {low && (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          Low stock
        </span>
      )}
    </Link>
  );
}
