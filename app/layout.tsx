import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BoxBuddy",
  description: "Small-business inventory tracker",
  manifest: "/manifest.json",
  themeColor: "#fb923c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-orange-50 text-stone-900">{children}</body>
    </html>
  );
}
