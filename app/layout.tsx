import "./globals.css";
import type { Metadata } from "next";
import { getLocale } from "../lib/i18n/server";
import { LocaleProvider } from "../lib/i18n/client";

export const metadata: Metadata = {
  title: "BoxBuddy",
  description: "Small-business inventory tracker",
  manifest: "/manifest.json",
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale}>
      <body className="bg-orange-50 text-stone-900">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
