// components/BarcodePrintLabel.tsx
"use client";

import { useTranslation } from "../lib/i18n/client";

export function BarcodePrintLabel({
  svg,
  name,
  sku,
}: {
  svg: string | null;
  name: string;
  sku: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-stone-300 p-4 print:border-none">
      {svg ? (
        <div
          className="h-20 w-full max-w-xs [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-sm text-red-600">{t("barcodePrintLabel.couldNotDraw")}</p>
      )}
      <p className="text-sm font-medium text-stone-800">{name}</p>
      <p className="text-xs text-stone-500">{sku}</p>
      <button
        onClick={() => window.print()}
        className="mt-2 text-sm text-orange-500 underline print:hidden"
      >
        {t("barcodePrintLabel.printLabel")}
      </button>
    </div>
  );
}
