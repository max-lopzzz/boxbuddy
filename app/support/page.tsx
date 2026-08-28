// app/support/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

const content: Record<
  Locale,
  { title: string; intro: string; discordCta: string; kofiIntro: string; kofiCta: string }
> = {
  en: {
    title: "Support",
    intro:
      "Need help with BoxBuddy? Send us an email and we'll get back to you as soon as we can.",
    discordCta: "Message me on Discord",
    kofiIntro: "Enjoying BoxBuddy? You can support its development on Ko-fi.",
    kofiCta: "Support me on Ko-fi",
  },
  es: {
    title: "Soporte",
    intro: "¿Necesitas ayuda con BoxBuddy? Envíanos un correo y te responderemos lo antes posible.",
    discordCta: "Escríbeme por Discord",
    kofiIntro: "¿Te gusta BoxBuddy? Puedes apoyar su desarrollo en Ko-fi.",
    kofiCta: "Apóyame en Ko-fi",
  },
};

export default function SupportPage() {
  const locale = getLocale();
  const { title, intro, discordCta, kofiIntro, kofiCta } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="text-sm text-stone-600">{intro}</p>
      <a href="mailto:m.lopz.montn@gmail.com" className="text-sm text-orange-500 underline">
        m.lopz.montn@gmail.com
      </a>
      <a
        href="https://discord.com/users/605435789010141207"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-orange-500 underline"
      >
        {discordCta}
      </a>
      <p className="text-sm text-stone-600">{kofiIntro}</p>
      <a
        href="https://ko-fi.com/P5P61TI6BS"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-white"
      >
        <span aria-hidden="true">☕</span>
        {kofiCta}
      </a>
    </main>
  );
}
