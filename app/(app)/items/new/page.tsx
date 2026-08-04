// app/(app)/items/new/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { ItemForm } from "../../../../components/ItemForm";

export default function NewItemPage() {
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? undefined;
  return <ItemForm prefillCode={prefillCode} />;
}
