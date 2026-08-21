// components/UpgradeButton.tsx
"use client";

import { useState } from "react";
import { PurchasesError, ErrorCode } from "@revenuecat/purchases-js";
import { presentPaywall } from "../lib/revenuecat/client";
import { useTranslation } from "../lib/i18n/client";

export function UpgradeButton({
  appUserId,
  onSuccess,
  className,
}: {
  appUserId: string;
  onSuccess: () => void;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const { t, locale } = useTranslation();

  async function handleClick() {
    setError(false);
    try {
      await presentPaywall(appUserId, locale);
      onSuccess();
    } catch (err) {
      if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
        return;
      }
      console.error("RevenueCat presentPaywall failed:", err);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={className ?? "rounded-lg bg-orange-400 p-2 text-sm font-medium text-white"}
      >
        {t("subscription.upgradeButton")}
      </button>
      {error && <p className="text-sm text-red-600">{t("subscription.paywallError")}</p>}
    </div>
  );
}
