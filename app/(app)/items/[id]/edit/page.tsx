// app/(app)/items/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { getItem } from "../../../../../lib/items";
import { ItemForm } from "../../../../../components/ItemForm";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  if (!item) notFound();
  return <ItemForm item={item} />;
}
