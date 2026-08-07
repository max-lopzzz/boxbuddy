"use client";

import Image from "next/image";
import { useTranslation } from "../lib/i18n/client";
import type { TranslationKey } from "../lib/i18n/types";

const ILLUSTRATION_SRC = {
  greet: "/illustrations/greet.png",
  "no-results": "/illustrations/no-results.png",
  loading: "/illustrations/loading.png",
} as const;

const ILLUSTRATION_ALT_KEY: Record<keyof typeof ILLUSTRATION_SRC, TranslationKey> = {
  greet: "emptyState.greetAlt",
  "no-results": "emptyState.noResultsAlt",
  loading: "emptyState.loadingAlt",
};

export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: keyof typeof ILLUSTRATION_SRC;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <Image
        src={ILLUSTRATION_SRC[illustration]}
        alt={t(ILLUSTRATION_ALT_KEY[illustration])}
        width={200}
        height={200}
      />
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      {action}
    </div>
  );
}
