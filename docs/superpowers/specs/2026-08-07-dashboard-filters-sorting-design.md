# BoxBuddy — Dashboard Filters & Sorting Design

## Overview

The dashboard (`app/(app)/page.tsx`) currently lists items in a single fixed order (most
recently updated first) with only a text search. This design adds sorting (by name, quantity,
category, or last updated) and filtering (by category, low-stock status, and quantity range),
so a user with many items can find and organize what they're looking for.

## Goals

- Sort the item list by: last updated (existing default), name (A-Z/Z-A), quantity
  (low-high/high-low), or category (A-Z/Z-A).
- Filter the item list by: category (exact match, chosen from a dropdown), low-stock-only
  (reusing the existing `isLowStock` logic), and a quantity range (min/max, either bound
  optional).
- Controls live in a collapsible "Filters" panel next to the search bar, so the default
  (collapsed) view is visually unchanged from today.
- Sort/filter selections persist across reloads (saved in `localStorage`).
- All filtering/sorting happens client-side on the already-fetched `items` array — no API
  or database changes.

## Non-Goals

- No changes to the search API or `listItems` server function — search continues to hit
  `/api/items?search=`, and filtering/sorting apply on top of whatever that returns.
- No pagination or virtualization — out of scope, unrelated to this feature.
- No multi-select category filter (only one category at a time).
- No saved/named filter presets — only the single "last used" state persisted.

## Architecture

- **New component**: `components/FilterSortPanel.tsx` — a client component rendered between
  `SearchBar` and the item list in `app/(app)/page.tsx`. Receives the current `items` (to
  derive the category dropdown's options) and a filter/sort state object + setter (lifted to
  the parent page so the page can apply it to `items` before rendering).
- **State shape** (`DashboardFilters`, defined alongside the component or in `lib/types.ts`):
  ```ts
  type SortKey = "updated_desc" | "name_asc" | "name_desc" | "quantity_asc" | "quantity_desc" | "category_asc" | "category_desc";
  type DashboardFilters = {
    sort: SortKey;
    category: string | null;   // null = all categories
    lowStockOnly: boolean;
    quantityMin: number | null;
    quantityMax: number | null;
  };
  ```
- **Applying filters/sort**: `app/(app)/page.tsx` computes `visibleItems` via `useMemo`,
  deriving from `items` + `filters`. This is a pure derivation — `items` itself (and the
  fetch/search flow) is untouched.
- **Category options**: derived from the unfiltered `items` list
  (`Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()`), so choosing a
  category never causes the dropdown's own option list to shrink.
- **Panel toggle**: local `isOpen` boolean in `FilterSortPanel`, not persisted — the panel
  always starts collapsed on page load, independent of whether filters are active.
- **Active-filter indicator**: the "Filters" button shows a small dot/badge when
  `filters` differs from the default (any non-default sort, category set, low-stock toggled
  on, or either quantity bound set), so a collapsed panel doesn't hide that the list is
  currently filtered.

## Persistence

- On every change, `filters` is written to `localStorage` under key
  `boxbuddy.dashboardFilters` as JSON.
- On mount, `app/(app)/page.tsx` reads that key and uses it as the initial state; if absent,
  malformed, or fails to parse, falls back to the default (`sort: "updated_desc"`, no filters
  active) — never throws.
- This is browser-local only (not synced to the account/server), consistent with it being a
  UI convenience rather than user data.

## Screens & Components

- **`app/(app)/page.tsx`**: search bar row gains a "Filters" toggle button next to the
  `SearchBar`. `visibleItems` (post filter/sort) replaces `items` in the render below the
  summary cards. Summary cards (`Items`, `Cost value`, `Low stock`) continue to reflect the
  *unfiltered* `items`, matching current behavior (they describe the whole inventory, not
  the current view).
- **`components/FilterSortPanel.tsx`**: renders collapsed by default; expands to:
  - Sort `<select>` (full width) — one of the 7 `SortKey` options.
  - Category `<select>` (full width) — "All categories" + one option per distinct category.
  - "Low stock only" checkbox + label (inline).
  - Quantity min/max — two `<input type="number">`s side by side.
  - "Clear filters" text button — right-aligned, rendered only when any filter (not sort)
    is active; resets `category`, `lowStockOnly`, `quantityMin`, `quantityMax` but leaves
    `sort` alone.
- **Empty state**: if `items` is non-empty but `visibleItems` is empty (filters excluded
  everything), render the existing `no-results` `EmptyState` illustration with a new message
  (`dashboard.noFilterMatches`), distinct from the existing search-no-match message
  (`dashboard.noMatchesForPrefix`) which is reserved for an empty *search* result.
- **i18n**: new keys added to both `lib/i18n/en.ts` and `lib/i18n/es.ts` following the
  existing flat-key pattern — button label, each sort option's label, "Category"/"All
  categories", "Low stock only", "Quantity", "Clear filters", and the new empty-state
  message.

## Error Handling

- Malformed/unparseable `localStorage` value: treated as absent, defaults used, no error
  shown (mirrors how the language-support design treats a bad locale cookie).
- A category value that no longer exists in `items` (e.g. the user deleted the last item of
  that category since the filter was saved): the dropdown simply won't show it as a current
  option, and the filter naturally yields zero results (empty state), not a crash.
- Quantity min > max: not blocked at input time; simply yields zero results (empty state) —
  no special-cased validation needed.

## Testing

- Unit tests for the pure filter/sort function (given an `Item[]` and `DashboardFilters`,
  asserts correct ordering and inclusion for each `SortKey`, category filter, low-stock
  filter, quantity range, and combinations of these).
- Unit test for the `localStorage` read fallback (malformed JSON → defaults).
- Manual verification: open dashboard with several items spanning categories/quantities →
  toggle each sort option and confirm order → filter by category and confirm only matching
  items show → toggle low-stock-only and confirm it matches the existing red "Low stock"
  badge on those same items → set a quantity range and confirm results → reload the page and
  confirm the last-used filters are still applied → clear filters and confirm return to
  default view.
