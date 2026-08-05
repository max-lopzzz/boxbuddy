// app/(app)/items/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../../../lib/auth";
import { getItem } from "../../../../lib/items";
import { renderQrSvg } from "../../../../lib/qr";
import { computeMargin, isLowStock } from "../../../../lib/item-helpers";
import { QrPrintLabel } from "../../../../components/QrPrintLabel";
import { DeleteItemButton } from "../../../../components/DeleteItemButton";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
  if (!item) notFound();

  const margin = computeMargin(item.cost, item.price);
  const low = isLowStock(item.quantity, item.reorder_at);
  const qrSvg = await renderQrSvg(item.qr_code);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/items/${item.id}/photo`}
          alt={item.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-xl font-semibold text-stone-800">{item.name}</h1>
      {low && (
        <span className="w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          Low stock
        </span>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="SKU" value={item.sku ?? "—"} />
        <Field label="Quantity" value={String(item.quantity)} />
        <Field label="Location" value={item.location ?? "—"} />
        <Field label="Category" value={item.category ?? "—"} />
        <Field label="Cost" value={item.cost !== null ? `$${item.cost.toFixed(2)}` : "—"} />
        <Field label="Price" value={item.price !== null ? `$${item.price.toFixed(2)}` : "—"} />
        <Field label="Margin" value={margin !== null ? `$${margin.toFixed(2)}` : "—"} />
      </dl>

      {item.notes && <p className="text-sm text-stone-600">{item.notes}</p>}

      <QrPrintLabel svg={qrSvg} name={item.name} sku={item.sku} />

      <div className="flex gap-2">
        <Link
          href={`/items/${item.id}/edit`}
          className="flex-1 rounded-lg border border-orange-300 p-3 text-center"
        >
          Edit
        </Link>
        <DeleteItemButton itemId={item.id} />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
