// app/support/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

const content: Record<Locale, { title: string; intro: string }> = {
  en: {
    title: "Support",
    intro:
      "Need help with BoxBuddy? Send us an email and we'll get back to you as soon as we can.",
  },
  es: {
    title: "Soporte",
    intro: "¿Necesitas ayuda con BoxBuddy? Envíanos un correo y te responderemos lo antes posible.",
  },
};

export default function SupportPage() {
  const locale = getLocale();
  const { title, intro } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="text-sm text-stone-600">{intro}</p>
      <a href="mailto:m.lopz.montn@gmail.com" className="text-sm text-orange-500 underline">
        m.lopz.montn@gmail.com
      </a>
    </main>
  );
}
