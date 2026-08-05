// components/AutocompleteInput.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api-client";

export function AutocompleteInput({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "location" | "category";
  value: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await apiFetch(`/api/items/autocomplete?field=${field}&q=${encodeURIComponent(value)}`);
      const body = await res.json();
      setSuggestions(body.values ?? []);
    }, 200);
    return () => clearTimeout(timeout);
  }, [value, field]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-stone-600">{label}</span>
      <input
        list={`${field}-suggestions`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-orange-200 p-2"
      />
      <datalist id={`${field}-suggestions`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
