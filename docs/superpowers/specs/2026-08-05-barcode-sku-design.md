# BoxBuddy — Barcode SKU Design

## Overview

BoxBuddy currently generates and scans **QR codes** to identify items, with a separate
free-text `sku` field that's typed manually. This was a mismatch with how the app is
actually used: items have real manufacturer **barcodes** (Code128/EAN/UPC), and the SKU
*is* that code — not a second, separately-typed value. This design replaces QR-code
generation with barcode generation, and removes manual SKU entry in favor of scanning
(or auto-generating one when no physical barcode exists).

## Goals

- Generate a scannable **barcode** (not a QR code) for items that don't already have a
  manufacturer barcode.
- The SKU field is filled by **scanning a barcode** — never by typing.
- Merge the concepts of "SKU" and "the item's unique code" into a single value/column.
- Printed labels show a barcode instead of a QR code.

## Non-Goals

- Any change to authentication, RLS, or Supabase Auth — this is purely an
  items/generation/UI change.
- Changing how existing item lookups/searches work — scanning to *find* an existing item
  is unaffected; only how new codes are created and displayed changes.
- Preserving the old free-text `sku` column's values where they differ from `qr_code` —
  see Data Model Changes.

## Data Model Changes

- The `items` table's `qr_code` column is renamed to `sku`. The old free-text `sku`
  column is dropped.
- `sku` remains `not null` with a `unique(owner_id, sku)` constraint — every item always
  has a value, either scanned from a real barcode or auto-generated.
- For any existing rows where the old `qr_code` and old free-text `sku` differ, the
  `qr_code` value is kept as the final `sku` (it's the value that actually identifies the
  item uniquely; the free-text field was never enforced to be unique or present).
- No changes to `owner_id`, RLS policies, or any other column.

## Architecture

- **Rendering**: `lib/qr.ts` is renamed to `lib/barcode.ts`. Its QR-rendering function is
  replaced with one that uses **bwip-js** to render a **Code128** barcode as an SVG.
  Code128 supports the full alphanumeric + underscore character set already used by our
  generated codes (e.g. `bb_xxxxx`), so the generation algorithm itself doesn't change —
  only how the resulting string is drawn. `generateCandidateCode`/`generateUniqueCode`
  are renamed to `generateCandidateSku`/`generateUniqueSku` (same logic, new name).
- **Scanning**: `components/QrScanner.tsx` is renamed to `BarcodeScanner.tsx`. No
  functional change — `html5-qrcode` (ZXing) already decodes Code128/EAN/UPC as well as
  QR, so it already works for barcodes today. This is a naming fix, not a behavior
  change.
- **Printed labels**: `components/QrPrintLabel.tsx` is renamed to
  `BarcodePrintLabel.tsx`, using `lib/barcode.ts`'s new rendering function instead of the
  QR renderer.
- **New dependency**: `bwip-js`.

## Screens & Components

- **Item form** (`components/ItemForm.tsx`): the SKU field is no longer a text input.
  It's replaced with:
  - A **"Scan barcode"** button that opens `BarcodeScanner` and fills the field from a
    detected code.
  - A **"I don't have a barcode"** button/link that calls `generateUniqueSku()` to
    generate one automatically.
  - Once filled (either way), the value displays read-only with a "Scan again" option.
  - There is no way to type the value manually — scanning or auto-generating are the
    only two paths.
- Any other screen showing "SKU" or "QR code" text (item detail, item list, print label,
  scan screen, help text) is updated to say "barcode" consistently.

## Error Handling

- If the camera fails or the user denies camera permission while scanning, show an
  inline error and point to "I don't have a barcode" as the alternative — there is no
  manual-entry fallback for this field, by design.
- Existing item lookup/search by code is unaffected; a 404/not-found result for an
  unrecognized scan behaves exactly as before.
- No data loss: existing `qr_code` string values are preserved as-is under the renamed
  `sku` column; only the rendering format for print labels changes (drawn as a barcode
  instead of a QR code going forward). Already-printed QR labels on physical items
  remain scannable exactly as before, since `BarcodeScanner`/ZXing already decodes QR too.

## Testing

- Unit tests for `renderBarcodeSvg` (replacing the old QR-rendering tests) and for
  `generateUniqueSku`.
- Manual verification: add an item by scanning a real barcode; add another via "I don't
  have a barcode" (generated); print its label; confirm the printed barcode scans
  correctly back into the app.
