// app/(app)/items/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "../../../../../lib/auth";
import { getItem } from "../../../../../lib/items";
import { ItemForm } from "../../../../../components/ItemForm";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const item = await getItem(userId, params.id);
  if (!item) notFound();
  return <ItemForm item={item} />;
}
