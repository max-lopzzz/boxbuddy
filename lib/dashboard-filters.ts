// lib/dashboard-filters.ts
import type { Item } from "./types";
import { isLowStock } from "./item-helpers";

export type SortKey =
  | "updated_desc"
  | "name_asc"
  | "name_desc"
  | "quantity_asc"
  | "quantity_desc"
  | "category_asc"
  | "category_desc";

export type DashboardFilters = {
  sort: SortKey;
  category: string | null;
  lowStockOnly: boolean;
  quantityMin: number | null;
  quantityMax: number | null;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  sort: "updated_desc",
  category: null,
  lowStockOnly: false,
  quantityMin: null,
  quantityMax: null,
};

export const DASHBOARD_FILTERS_STORAGE_KEY = "boxbuddy.dashboardFilters";

const SORT_COMPARATORS: Record<SortKey, (a: Item, b: Item) => number> = {
  updated_desc: (a, b) => b.updated_at.localeCompare(a.updated_at),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  quantity_asc: (a, b) => a.quantity - b.quantity,
  quantity_desc: (a, b) => b.quantity - a.quantity,
  category_asc: (a, b) => (a.category ?? "").localeCompare(b.category ?? ""),
  category_desc: (a, b) => (b.category ?? "").localeCompare(a.category ?? ""),
};

export function applyDashboardFilters(items: Item[], filters: DashboardFilters): Item[] {
  const filtered = items.filter((item) => {
    if (filters.category !== null && item.category !== filters.category) return false;
    if (filters.lowStockOnly && !isLowStock(item.quantity, item.reorder_at)) return false;
    if (filters.quantityMin !== null && item.quantity < filters.quantityMin) return false;
    if (filters.quantityMax !== null && item.quantity > filters.quantityMax) return false;
    return true;
  });
  return [...filtered].sort(SORT_COMPARATORS[filters.sort]);
}

export function dashboardCategoryOptions(items: Item[]): string[] {
  const categories = items
    .map((item) => item.category)
    .filter((category): category is string => category !== null && category !== "");
  return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
}

export function hasActiveDashboardFilters(filters: DashboardFilters): boolean {
  return (
    filters.category !== null ||
    filters.lowStockOnly ||
    filters.quantityMin !== null ||
    filters.quantityMax !== null
  );
}

export function parseDashboardFilters(raw: string | null): DashboardFilters {
  if (!raw) return DEFAULT_DASHBOARD_FILTERS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_DASHBOARD_FILTERS;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_DASHBOARD_FILTERS;
  }

  const p = parsed as Record<string, unknown>;
  const sort =
    typeof p.sort === "string" && p.sort in SORT_COMPARATORS
      ? (p.sort as SortKey)
      : DEFAULT_DASHBOARD_FILTERS.sort;
  const category = typeof p.category === "string" ? p.category : null;
  const lowStockOnly = p.lowStockOnly === true;
  const quantityMin = typeof p.quantityMin === "number" ? p.quantityMin : null;
  const quantityMax = typeof p.quantityMax === "number" ? p.quantityMax : null;

  return { sort, category, lowStockOnly, quantityMin, quantityMax };
}
