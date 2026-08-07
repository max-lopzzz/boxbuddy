// components/FieldLabel.tsx
"use client";

import { useState } from "react";

export function FieldLabel({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="flex items-center gap-1">
        <span className="text-sm text-stone-600">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          aria-label={`Info about ${label}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-300 text-[10px] leading-none text-stone-500"
        >
          i
        </button>
      </span>
      {open && <span className="text-xs text-stone-500">{hint}</span>}
    </>
  );
}
