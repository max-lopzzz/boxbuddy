# Dashboard Filters & Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sorting (name/quantity/category/last-updated) and filtering (category/low-stock/quantity range) controls to the dashboard, in a collapsible panel next to the search bar, with the last-used selection remembered across reloads.

**Architecture:** A new pure module (`lib/dashboard-filters.ts`) holds the filter/sort types, the derivation logic, and `localStorage` (de)serialization — all unit-testable with no DOM. A new client component (`components/FilterSortPanel.tsx`) renders the collapsible UI and calls back into the dashboard page with the updated filter state. `app/(app)/page.tsx` owns the `DashboardFilters` state, persists it to `localStorage`, and derives `visibleItems` from `items` + `filters` via `useMemo` — the existing fetch/search flow is untouched.

**Tech Stack:** Next.js 14 (App Router) client components, React 18, TypeScript, Tailwind CSS, Vitest (node environment, no jsdom/React Testing Library available).

Reference spec: `docs/superpowers/specs/2026-08-07-dashboard-filters-sorting-design.md`

## Global Constraints

- No new npm dependencies.
- No changes to `/api/items`, `lib/items.ts`, or the search flow — filtering/sorting apply
  entirely client-side to the `items` array already fetched by `app/(app)/page.tsx`.
- Every new user-facing string is added to **both** `lib/i18n/en.ts` and `lib/i18n/es.ts`.
  `tests/lib/i18n/dictionaries.test.ts` already asserts the two dictionaries have identical
  key sets and no empty values — it must keep passing.
- `localStorage` key is exactly `boxbuddy.dashboardFilters`, exported as the constant
  `DASHBOARD_FILTERS_STORAGE_KEY` from `lib/dashboard-filters.ts`.
- Test runner is `npm test` (Vitest, `environment: "node"` per `vitest.config.ts` — no DOM
  available). Only the pure logic in `lib/dashboard-filters.ts` gets automated tests, matching
  this repo's existing pattern where `tests/` covers `lib/*` and API routes but not components.
  Component/page changes are verified manually in a browser.

---

### Task 1: Pure filter/sort/persistence logic

**Files:**
- Create: `lib/dashboard-filters.ts`
- Test: `tests/lib/dashboard-filters.test.ts`

**Interfaces:**
- Consumes: `Item` type from `lib/types.ts` (fields used: `id`, `name`, `quantity`,
  `reorder_at`, `category`, `updated_at`); `isLowStock(quantity, reorderAt)` from
  `lib/item-helpers.ts`.
- Produces (used by Tasks 3 and 4):
  - `type SortKey = "updated_desc" | "name_asc" | "name_desc" | "quantity_asc" | "quantity_desc" | "category_asc" | "category_desc"`
  - `type DashboardFilters = { sort: SortKey; category: string | null; lowStockOnly: boolean; quantityMin: number | null; quantityMax: number | null }`
  - `DEFAULT_DASHBOARD_FILTERS: DashboardFilters`
  - `DASHBOARD_FILTERS_STORAGE_KEY: string`
  - `applyDashboardFilters(items: Item[], filters: DashboardFilters): Item[]`
  - `dashboardCategoryOptions(items: Item[]): string[]`
  - `hasActiveDashboardFilters(filters: DashboardFilters): boolean`
  - `parseDashboardFilters(raw: string | null): DashboardFilters`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/dashboard-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Item } from "../../lib/types";
import {
  applyDashboardFilters,
  dashboardCategoryOptions,
  hasActiveDashboardFilters,
  parseDashboardFilters,
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilters,
} from "../../lib/dashboard-filters";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "1",
    sku: "bb_1",
    name: "Widget",
    quantity: 1,
    reorder_at: null,
    location: null,
    category: null,
    notes: null,
    cost: null,
    price: null,
    photo_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyDashboardFilters", () => {
  const items = [
    makeItem({
      id: "1",
      name: "Banana",
      quantity: 5,
      category: "Food",
      updated_at: "2026-01-03T00:00:00.000Z",
    }),
    makeItem({
      id: "2",
      name: "Apple",
      quantity: 10,
      category: "Food",
      updated_at: "2026-01-01T00:00:00.000Z",
    }),
    makeItem({
      id: "3",
      name: "Wrench",
      quantity: 2,
      category: "Tools",
      reorder_at: 5,
      updated_at: "2026-01-02T00:00:00.000Z",
    }),
  ];

  it("sorts by updated_desc by default", () => {
    const result = applyDashboardFilters(items, DEFAULT_DASHBOARD_FILTERS);
    expect(result.map((i) => i.id)).toEqual(["1", "3", "2"]);
  });

  it("sorts by name ascending and descending", () => {
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "name_asc" }).map(
        (i) => i.name
      )
    ).toEqual(["Apple", "Banana", "Wrench"]);
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "name_desc" }).map(
        (i) => i.name
      )
    ).toEqual(["Wrench", "Banana", "Apple"]);
  });

  it("sorts by quantity ascending and descending", () => {
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "quantity_asc" }).map(
        (i) => i.quantity
      )
    ).toEqual([2, 5, 10]);
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "quantity_desc" }).map(
        (i) => i.quantity
      )
    ).toEqual([10, 5, 2]);
  });

  it("sorts by category ascending and descending", () => {
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "category_asc" }).map(
        (i) => i.category
      )
    ).toEqual(["Food", "Food", "Tools"]);
    expect(
      applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, sort: "category_desc" }).map(
        (i) => i.category
      )
    ).toEqual(["Tools", "Food", "Food"]);
  });

  it("filters by category", () => {
    const result = applyDashboardFilters(items, {
      ...DEFAULT_DASHBOARD_FILTERS,
      category: "Tools",
    });
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("filters by low stock only", () => {
    const result = applyDashboardFilters(items, {
      ...DEFAULT_DASHBOARD_FILTERS,
      lowStockOnly: true,
    });
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("filters by quantity range", () => {
    const result = applyDashboardFilters(items, {
      ...DEFAULT_DASHBOARD_FILTERS,
      quantityMin: 3,
      quantityMax: 6,
    });
    expect(result.map((i) => i.id)).toEqual(["1"]);
  });

  it("combines filters and sort", () => {
    const result = applyDashboardFilters(items, {
      sort: "quantity_asc",
      category: "Food",
      lowStockOnly: false,
      quantityMin: null,
      quantityMax: null,
    });
    expect(result.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = applyDashboardFilters(items, { ...DEFAULT_DASHBOARD_FILTERS, quantityMin: 100 });
    expect(result).toEqual([]);
  });
});

describe("dashboardCategoryOptions", () => {
  it("returns unique, sorted, non-null categories", () => {
    const items = [
      makeItem({ category: "Tools" }),
      makeItem({ category: "Food" }),
      makeItem({ category: "Food" }),
      makeItem({ category: null }),
    ];
    expect(dashboardCategoryOptions(items)).toEqual(["Food", "Tools"]);
  });

  it("returns an empty array when no items have a category", () => {
    expect(dashboardCategoryOptions([makeItem({ category: null })])).toEqual([]);
  });
});

describe("hasActiveDashboardFilters", () => {
  it("is false for the default filters", () => {
    expect(hasActiveDashboardFilters(DEFAULT_DASHBOARD_FILTERS)).toBe(false);
  });

  it("is false when only sort is non-default", () => {
    expect(hasActiveDashboardFilters({ ...DEFAULT_DASHBOARD_FILTERS, sort: "name_asc" })).toBe(
      false
    );
  });

  it("is true when any filter is set", () => {
    expect(hasActiveDashboardFilters({ ...DEFAULT_DASHBOARD_FILTERS, category: "Food" })).toBe(
      true
    );
    expect(hasActiveDashboardFilters({ ...DEFAULT_DASHBOARD_FILTERS, lowStockOnly: true })).toBe(
      true
    );
    expect(hasActiveDashboardFilters({ ...DEFAULT_DASHBOARD_FILTERS, quantityMin: 1 })).toBe(
      true
    );
    expect(hasActiveDashboardFilters({ ...DEFAULT_DASHBOARD_FILTERS, quantityMax: 1 })).toBe(
      true
    );
  });
});

describe("parseDashboardFilters", () => {
  it("returns defaults when raw is null", () => {
    expect(parseDashboardFilters(null)).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it("returns defaults when raw is malformed JSON", () => {
    expect(parseDashboardFilters("{not json")).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it("returns defaults when raw is a JSON array instead of an object", () => {
    expect(parseDashboardFilters("[]")).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it("round-trips a full valid filters object", () => {
    const filters: DashboardFilters = {
      sort: "quantity_desc",
      category: "Tools",
      lowStockOnly: true,
      quantityMin: 1,
      quantityMax: 9,
    };
    expect(parseDashboardFilters(JSON.stringify(filters))).toEqual(filters);
  });

  it("falls back to the default sort when the stored sort key is invalid", () => {
    const result = parseDashboardFilters(JSON.stringify({ sort: "bogus" }));
    expect(result.sort).toBe(DEFAULT_DASHBOARD_FILTERS.sort);
  });

  it("ignores non-number quantity bounds", () => {
    const result = parseDashboardFilters(JSON.stringify({ quantityMin: "five" }));
    expect(result.quantityMin).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- dashboard-filters`
Expected: FAIL — `lib/dashboard-filters.ts` does not exist yet (module resolution error).

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard-filters.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dashboard-filters`
Expected: PASS — all tests in `tests/lib/dashboard-filters.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-filters.ts tests/lib/dashboard-filters.test.ts
git commit -m "Add pure dashboard filter/sort/persistence logic"
```

---

### Task 2: Add i18n translation keys

**Files:**
- Modify: `lib/i18n/en.ts:56` (after `"dashboard.searchPlaceholder"`)
- Modify: `lib/i18n/es.ts:58` (after `"dashboard.searchPlaceholder"`)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 3): the following `TranslationKey`s become available to `t()`:
  `dashboard.filtersButton`, `dashboard.sortLabel`, `dashboard.sortUpdatedDesc`,
  `dashboard.sortNameAsc`, `dashboard.sortNameDesc`, `dashboard.sortQuantityAsc`,
  `dashboard.sortQuantityDesc`, `dashboard.sortCategoryAsc`, `dashboard.sortCategoryDesc`,
  `dashboard.allCategories`, `dashboard.lowStockOnly`, `dashboard.quantityMinLabel`,
  `dashboard.quantityMaxLabel`, `dashboard.clearFilters`, `dashboard.noFilterMatchesTitle`.
  (`common.category` already exists and is reused as-is for the category select's label.)

- [ ] **Step 1: Add the English keys**

In `lib/i18n/en.ts`, find this line:

```ts
  "dashboard.searchPlaceholder": "Search by name or SKU",
```

Replace it with:

```ts
  "dashboard.searchPlaceholder": "Search by name or SKU",
  "dashboard.filtersButton": "Filters",
  "dashboard.sortLabel": "Sort by",
  "dashboard.sortUpdatedDesc": "Last updated",
  "dashboard.sortNameAsc": "Name (A–Z)",
  "dashboard.sortNameDesc": "Name (Z–A)",
  "dashboard.sortQuantityAsc": "Quantity (low to high)",
  "dashboard.sortQuantityDesc": "Quantity (high to low)",
  "dashboard.sortCategoryAsc": "Category (A–Z)",
  "dashboard.sortCategoryDesc": "Category (Z–A)",
  "dashboard.allCategories": "All categories",
  "dashboard.lowStockOnly": "Low stock only",
  "dashboard.quantityMinLabel": "Min quantity",
  "dashboard.quantityMaxLabel": "Max quantity",
  "dashboard.clearFilters": "Clear filters",
  "dashboard.noFilterMatchesTitle": "No items match your filters",
```

- [ ] **Step 2: Add the matching Spanish keys**

In `lib/i18n/es.ts`, find this line:

```ts
  "dashboard.searchPlaceholder": "Buscar por nombre o SKU",
```

Replace it with:

```ts
  "dashboard.searchPlaceholder": "Buscar por nombre o SKU",
  "dashboard.filtersButton": "Filtros",
  "dashboard.sortLabel": "Ordenar por",
  "dashboard.sortUpdatedDesc": "Última actualización",
  "dashboard.sortNameAsc": "Nombre (A–Z)",
  "dashboard.sortNameDesc": "Nombre (Z–A)",
  "dashboard.sortQuantityAsc": "Cantidad (menor a mayor)",
  "dashboard.sortQuantityDesc": "Cantidad (mayor a menor)",
  "dashboard.sortCategoryAsc": "Categoría (A–Z)",
  "dashboard.sortCategoryDesc": "Categoría (Z–A)",
  "dashboard.allCategories": "Todas las categorías",
  "dashboard.lowStockOnly": "Solo stock bajo",
  "dashboard.quantityMinLabel": "Cantidad mínima",
  "dashboard.quantityMaxLabel": "Cantidad máxima",
  "dashboard.clearFilters": "Limpiar filtros",
  "dashboard.noFilterMatchesTitle": "Ningún artículo coincide con tus filtros",
```

- [ ] **Step 3: Run the dictionary parity test**

Run: `npm test -- dictionaries`
Expected: PASS — `tests/lib/i18n/dictionaries.test.ts` confirms `en.ts` and `es.ts` still have
identical key sets and no empty values.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/en.ts lib/i18n/es.ts
git commit -m "Add translation keys for dashboard filters and sorting"
```

---

### Task 3: FilterSortPanel component

**Files:**
- Create: `components/FilterSortPanel.tsx`

**Interfaces:**
- Consumes: `Item` (`lib/types.ts`); `DashboardFilters`, `SortKey`, `DEFAULT_DASHBOARD_FILTERS`,
  `dashboardCategoryOptions`, `hasActiveDashboardFilters` (`lib/dashboard-filters.ts`, Task 1);
  `useTranslation` (`lib/i18n/client.tsx`); `TranslationKey` (`lib/i18n/types.ts`); the
  `dashboard.*` and `common.category` keys added in Task 2.
- Produces (used by Task 4): `FilterSortPanel` component with props
  `{ items: Item[]; filters: DashboardFilters; onChange: (filters: DashboardFilters) => void }`.
  Renders as a `<>` fragment: a trigger `<button>` (flex item, sits next to the search input)
  followed conditionally by a `w-full` panel `<div>` (so it drops to its own line inside a
  `flex flex-wrap` parent row) when expanded.

- [ ] **Step 1: Write the component**

Create `components/FilterSortPanel.tsx`:

```tsx
// components/FilterSortPanel.tsx
"use client";

import { useState } from "react";
import type { Item } from "../lib/types";
import { useTranslation } from "../lib/i18n/client";
import type { TranslationKey } from "../lib/i18n/types";
import {
  DEFAULT_DASHBOARD_FILTERS,
  dashboardCategoryOptions,
  hasActiveDashboardFilters,
  type DashboardFilters,
  type SortKey,
} from "../lib/dashboard-filters";

const SORT_OPTION_LABELS: Record<SortKey, TranslationKey> = {
  updated_desc: "dashboard.sortUpdatedDesc",
  name_asc: "dashboard.sortNameAsc",
  name_desc: "dashboard.sortNameDesc",
  quantity_asc: "dashboard.sortQuantityAsc",
  quantity_desc: "dashboard.sortQuantityDesc",
  category_asc: "dashboard.sortCategoryAsc",
  category_desc: "dashboard.sortCategoryDesc",
};

const SORT_KEYS = Object.keys(SORT_OPTION_LABELS) as SortKey[];

export function FilterSortPanel({
  items,
  filters,
  onChange,
}: {
  items: Item[];
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const categories = dashboardCategoryOptions(items);
  const isActive = hasActiveDashboardFilters(filters);

  function update(partial: Partial<DashboardFilters>) {
    onChange({ ...filters, ...partial });
  }

  function clearFilters() {
    onChange({
      ...filters,
      category: DEFAULT_DASHBOARD_FILTERS.category,
      lowStockOnly: DEFAULT_DASHBOARD_FILTERS.lowStockOnly,
      quantityMin: DEFAULT_DASHBOARD_FILTERS.quantityMin,
      quantityMax: DEFAULT_DASHBOARD_FILTERS.quantityMax,
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative shrink-0 rounded-lg border border-orange-200 px-3 py-2 text-sm text-stone-700"
      >
        {t("dashboard.filtersButton")}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-400"
          />
        )}
      </button>

      {isOpen && (
        <div className="flex w-full flex-col gap-3 rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            {t("dashboard.sortLabel")}
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className="rounded-lg border border-orange-200 p-2"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(SORT_OPTION_LABELS[key])}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-stone-600">
            {t("common.category")}
            <select
              value={filters.category ?? ""}
              onChange={(e) => update({ category: e.target.value === "" ? null : e.target.value })}
              className="rounded-lg border border-orange-200 p-2"
            >
              <option value="">{t("dashboard.allCategories")}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={filters.lowStockOnly}
              onChange={(e) => update({ lowStockOnly: e.target.checked })}
            />
            {t("dashboard.lowStockOnly")}
          </label>

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-label={t("dashboard.quantityMinLabel")}
              placeholder={t("dashboard.quantityMinLabel")}
              value={filters.quantityMin ?? ""}
              onChange={(e) =>
                update({ quantityMin: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-full rounded-lg border border-orange-200 p-2 text-sm"
            />
            <span aria-hidden="true" className="text-stone-400">
              –
            </span>
            <input
              type="number"
              inputMode="numeric"
              aria-label={t("dashboard.quantityMaxLabel")}
              placeholder={t("dashboard.quantityMaxLabel")}
              value={filters.quantityMax ?? ""}
              onChange={(e) =>
                update({ quantityMax: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-full rounded-lg border border-orange-200 p-2 text-sm"
            />
          </div>

          {isActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-end text-sm font-medium text-orange-600"
            >
              {t("dashboard.clearFilters")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `components/FilterSortPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/FilterSortPanel.tsx
git commit -m "Add FilterSortPanel component"
```

---

### Task 4: Wire filters into the dashboard page

**Files:**
- Modify: `app/(app)/page.tsx` (full file rewrite — changes touch imports, state, and JSX
  throughout)

**Interfaces:**
- Consumes: `FilterSortPanel` (Task 3); `applyDashboardFilters`,
  `DASHBOARD_FILTERS_STORAGE_KEY`, `DEFAULT_DASHBOARD_FILTERS`, `parseDashboardFilters`,
  `DashboardFilters` (Task 1); `dashboard.noFilterMatchesTitle` (Task 2).
- Produces: nothing consumed elsewhere — this is the final integration point.

- [ ] **Step 1: Replace the dashboard page**

Replace the full contents of `app/(app)/page.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ItemCard } from "../../components/ItemCard";
import { SearchBar } from "../../components/SearchBar";
import { EmptyState } from "../../components/EmptyState";
import { FilterSortPanel } from "../../components/FilterSortPanel";
import { isLowStock } from "../../lib/item-helpers";
import { apiFetch } from "../../lib/api-client";
import { useTranslation } from "../../lib/i18n/client";
import {
  applyDashboardFilters,
  DASHBOARD_FILTERS_STORAGE_KEY,
  DEFAULT_DASHBOARD_FILTERS,
  parseDashboardFilters,
  type DashboardFilters,
} from "../../lib/dashboard-filters";
import type { Item } from "../../lib/types";

export default function DashboardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [search, setSearch] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_DASHBOARD_FILTERS);
  const { t } = useTranslation();

  useEffect(() => {
    setFilters(parseDashboardFilters(window.localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY)));
  }, []);

  function updateFilters(next: DashboardFilters) {
    setFilters(next);
    window.localStorage.setItem(DASHBOARD_FILTERS_STORAGE_KEY, JSON.stringify(next));
  }

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

  const visibleItems = useMemo(
    () => (items ? applyDashboardFilters(items, filters) : null),
    [items, filters]
  );

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBar onSearch={setSearch} />
        </div>
        <FilterSortPanel items={items ?? []} filters={filters} onChange={updateFilters} />
      </div>

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

      {items !== null && items.length > 0 && visibleItems && visibleItems.length === 0 && (
        <EmptyState illustration="no-results" title={t("dashboard.noFilterMatchesTitle")} />
      )}

      {visibleItems !== null && visibleItems.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
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
```

- [ ] **Step 2: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all existing and new tests pass.

- [ ] **Step 3: Manual verification in a browser**

Start the dev server and open the dashboard with several items spanning different
categories/quantities/low-stock states (use the existing "Add item" flow if the account has
no items yet). Verify, in order:

1. Default view is visually unchanged from before (no visible layout shift, "Filters" button
   appears to the right of the search input with no badge dot).
2. Tap "Filters" — panel expands below the search row with Sort, Category, "Low stock only",
   and quantity min/max fields.
3. Change Sort to each of the 7 options — confirm the list re-orders correctly each time
   (name A-Z/Z-A, quantity low-high/high-low, category A-Z/Z-A, last updated).
4. Pick a Category — confirm only items with that exact category remain, and the badge dot
   appears on the "Filters" button when the panel is collapsed.
5. Toggle "Low stock only" — confirm it matches exactly the items showing the red "Low stock"
   badge on their cards.
6. Set a quantity min and/or max — confirm only items within range remain.
7. Combine several filters at once — confirm they all apply together (AND, not OR).
8. Set filters that match zero items — confirm the "No items match your filters" empty state
   appears (distinct from the "no items yet" and search-no-match empty states).
9. Click "Clear filters" — confirm category/low-stock/quantity reset but Sort is left alone.
10. Reload the page — confirm the last-used sort/filters are still applied (read from
    `localStorage`).
11. Type in the search box while filters are active — confirm search and filters compose
    (search narrows the fetched set, filters further narrow what's displayed).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/page.tsx"
git commit -m "Wire filter and sort controls into the dashboard"
```
