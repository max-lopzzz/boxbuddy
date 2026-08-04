// components/SearchBar.tsx
"use client";

import { useEffect, useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timeout);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      placeholder="Search by name or SKU"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-orange-200 p-3"
    />
  );
}
