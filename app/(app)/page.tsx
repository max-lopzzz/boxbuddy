"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ItemCard } from "../../components/ItemCard";
import { SearchBar } from "../../components/SearchBar";
import { EmptyState } from "../../components/EmptyState";
import { isLowStock } from "../../lib/item-helpers";
import { apiFetch } from "../../lib/api-client";
import { useTranslation } from "../../lib/i18n/client";
import type { Item } from "../../lib/types";

export default function DashboardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [search, setSearch] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchItems = useCallback(
    async (query: string) => {
      setItems(null);
      setFetchError(null);
      const url = query ? `/api/items?search=${encodeURIComponent(query)}` : "/api/items";
      try {
        const res = await apiFetch(url);
        if (!res.ok) {
          setFetchError(t("dashboard.couldNotLoadInventory"));
          setItems([]);
          return;
        }
        const body = await res.json();
        setItems(body.items ?? []);
      } catch {
        setFetchError(t("dashboard.couldNotLoadInventory"));
        setItems([]);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchItems(search);
  }, [search, fetchItems]);

  const totalCostValue = items?.reduce((sum, i) => sum + (i.cost ?? 0) * i.quantity, 0) ?? 0;
  const lowStockCount = items?.filter((i) => isLowStock(i.quantity, i.reorder_at)).length ?? 0;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      {fetchError && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{fetchError}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={t("dashboard.itemsLabel")} value={items?.length ?? "…"} />
        <SummaryCard label={t("dashboard.costValueLabel")} value={`$${totalCostValue.toFixed(2)}`} />
        <SummaryCard label={t("common.lowStock")} value={lowStockCount} />
      </div>

      <SearchBar onSearch={setSearch} />

      {items === null && (
        <EmptyState illustration="loading" title={t("dashboard.loadingInventory")} />
      )}

      {items !== null && items.length === 0 && search === "" && (
        <EmptyState
          illustration="greet"
          title={t("dashboard.noItemsYetTitle")}
          subtitle={t("dashboard.noItemsYetSubtitle")}
          action={
            <Link href="/items/new" className="rounded-lg bg-orange-400 px-4 py-2 text-white">
              {t("dashboard.addItem")}
            </Link>
          }
        />
      )}

      {items !== null && items.length === 0 && search !== "" && (
        <EmptyState
          illustration="no-results"
          title={`${t("dashboard.noMatchesForPrefix")} "${search}"`}
        />
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
        <Link href="/scan" className="rounded-full bg-stone-800 px-5 py-3 text-white shadow-lg">
          {t("dashboard.scanButton")}
        </Link>
        <Link href="/items/new" className="rounded-full bg-orange-400 px-5 py-3 text-white shadow-lg">
          {t("dashboard.addItem")}
        </Link>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-orange-50 p-3 text-center">
      <p className="text-lg font-semibold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
