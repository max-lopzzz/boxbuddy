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
