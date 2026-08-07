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
