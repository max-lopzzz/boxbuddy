// components/ItemForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { Item, ItemInput } from "../lib/types";
import { apiFetch } from "../lib/api-client";
import { AutocompleteInput } from "./AutocompleteInput";
import { BarcodeScanner } from "./BarcodeScanner";

type ItemFormValues = {
  name: string;
  sku: string;
  quantity: string;
  reorder_at: string;
  location: string;
  category: string;
  notes: string;
  cost: string;
  price: string;
};

type SkuMode = "empty" | "scanning" | "filled" | "auto";

function toFormValues(item?: Item, prefillCode?: string): ItemFormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? prefillCode ?? "",
    quantity: item ? String(item.quantity) : "0",
    reorder_at:
      item?.reorder_at !== null && item?.reorder_at !== undefined ? String(item.reorder_at) : "",
    location: item?.location ?? "",
    category: item?.category ?? "",
    notes: item?.notes ?? "",
    cost: item?.cost !== null && item?.cost !== undefined ? String(item.cost) : "",
    price: item?.price !== null && item?.price !== undefined ? String(item.price) : "",
  };
}

export function ItemForm({ item, prefillCode }: { item?: Item; prefillCode?: string }) {
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item, prefillCode));
  const [skuMode, setSkuMode] = useState<SkuMode>(item?.sku || prefillCode ? "filled" : "empty");
  const [scanError, setScanError] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedItemState, setSavedItemState] = useState<Item | undefined>(item);
  const router = useRouter();

  function update<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be 5MB or smaller.");
      setPhotoFile(null);
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  }

  function handleScan(code: string) {
    update("sku", code);
    setSkuMode("filled");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: ItemInput = {
      name: values.name,
      quantity: Number(values.quantity) || 0,
      reorder_at: values.reorder_at === "" ? null : Number(values.reorder_at),
      location: values.location || null,
      category: values.category || null,
      notes: values.notes || null,
      cost: values.cost === "" ? null : Number(values.cost),
      price: values.price === "" ? null : Number(values.price),
      ...(values.sku ? { sku: values.sku } : {}),
    };

    const url = savedItemState ? `/api/items/${savedItemState.id}` : "/api/items";
    const method = savedItemState ? "PATCH" : "POST";
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const body = await res.json();
    const savedItem = body.item as Item;
    setSavedItemState(savedItem);

    if (photoFile) {
      const formData = new FormData();
      formData.append("photo", photoFile);
      const photoRes = await apiFetch(`/api/items/${savedItem.id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!photoRes.ok) {
        const photoBody = await photoRes.json().catch(() => ({}));
        setError(photoBody.error ?? "The item saved, but the photo upload failed. You can try again below.");
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    router.refresh();
    router.push(`/items/${savedItem.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Name</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-orange-200 p-2"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">SKU</span>
        {skuMode === "scanning" ? (
          <div className="flex flex-col gap-2">
            <BarcodeScanner
              onScan={handleScan}
              onCameraError={() => setScanError(true)}
              formatsToSupport={[
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ]}
            />
            <button
              type="button"
              onClick={() => setSkuMode(values.sku ? "filled" : "empty")}
              className="text-sm text-stone-500 underline"
            >
              Cancel
            </button>
            {scanError && (
              <p className="text-sm text-red-600">
                Couldn&apos;t access the camera. Try &quot;I don&apos;t have a barcode&quot;
                instead.
              </p>
            )}
          </div>
        ) : values.sku ? (
          <div className="flex items-center justify-between rounded-lg border border-orange-200 p-2">
            <span className="text-stone-800">{values.sku}</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="text-sm text-orange-500 underline"
              >
                Scan again
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => {
                    update("sku", "");
                    setSkuMode("empty");
                  }}
                  className="text-sm text-stone-500 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-500">
              {skuMode === "auto"
                ? "A code will be generated automatically when you save."
                : savedItemState
                  ? "Scan this item's new barcode."
                  : "Scan this item's barcode, or generate one if it doesn't have one."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanError(false);
                  setSkuMode("scanning");
                }}
                className="flex-1 rounded-lg border border-orange-300 p-2 text-sm text-stone-700"
              >
                Scan barcode
              </button>
              {!savedItemState && (
                <button
                  type="button"
                  onClick={() => setSkuMode("auto")}
                  className="flex-1 rounded-lg border border-stone-300 p-2 text-sm text-stone-700"
                >
                  I don&apos;t have a barcode
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Quantity</span>
          <input
            type="number"
            value={values.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Reorder at</span>
          <input
            type="number"
            value={values.reorder_at}
            onChange={(e) => update("reorder_at", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
      </div>

      <AutocompleteInput
        label="Location"
        field="location"
        value={values.location}
        onChange={(v) => update("location", v)}
      />
      <AutocompleteInput
        label="Category"
        field="category"
        value={values.category}
        onChange={(v) => update("category", v)}
      />

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Cost</span>
          <input
            type="number"
            step="0.01"
            value={values.cost}
            onChange={(e) => update("cost", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-stone-600">Price</span>
          <input
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            className="rounded-lg border border-orange-200 p-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Notes</span>
        <textarea
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-lg border border-orange-200 p-2"
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">Photo</span>
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
        {photoError && <span className="text-sm text-red-600">{photoError}</span>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-orange-400 p-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : savedItemState ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
