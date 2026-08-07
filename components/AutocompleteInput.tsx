// components/AutocompleteInput.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { FieldLabel } from "./FieldLabel";

export function AutocompleteInput({
  label,
  hint,
  placeholder,
  field,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder?: string;
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
      <FieldLabel label={label} hint={hint} />
      <input
        list={`${field}-suggestions`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-orange-200 p-2 placeholder:text-stone-400"
      />
      <datalist id={`${field}-suggestions`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </label>
  );
}
