// app/terms/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

type Section = { heading: string; body: string };

const content: Record<Locale, { title: string; lastUpdated: string; sections: Section[] }> = {
  en: {
    title: "Terms of Service",
    lastUpdated: "Last updated: August 10, 2026",
    sections: [
      {
        heading: "Acceptance of Terms",
        body: "By creating a BoxBuddy account, you agree to these Terms of Service. If you do not agree, please do not use BoxBuddy.",
      },
      {
        heading: "Your Account",
        body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when creating your account.",
      },
      {
        heading: "Subscriptions and Billing",
        body: "BoxBuddy offers a free tier (up to 50 items) and paid BoxBuddy Pro tiers (Monthly, Yearly, and Lifetime) with higher or unlimited item limits and barcode label printing. Paid subscriptions are billed and processed through RevenueCat and Stripe, and renew automatically until cancelled. You can manage or cancel your subscription at any time from the Settings page in the app, or by emailing m.lopz.montn@gmail.com. We do not offer refunds for partial billing periods, except where required by law.",
      },
      {
        heading: "Acceptable Use",
        body: "You agree not to use BoxBuddy for any unlawful purpose, to attempt to access another user's data, or to interfere with the normal operation of the service.",
      },
      {
        heading: "Service Availability",
        body: 'BoxBuddy is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee that the service will be uninterrupted, error-free, or available at all times.',
      },
      {
        heading: "Limitation of Liability",
        body: "To the fullest extent permitted by law, BoxBuddy and its operator are not liable for any indirect, incidental, or consequential damages arising from your use of the service, including loss of data.",
      },
      {
        heading: "Termination",
        body: "We may suspend or terminate your access to BoxBuddy if you violate these Terms. You may stop using BoxBuddy and cancel your subscription at any time.",
      },
      {
        heading: "Changes to These Terms",
        body: "We may update these Terms from time to time. Continued use of BoxBuddy after changes are posted constitutes acceptance of the updated Terms.",
      },
      {
        heading: "Governing Law",
        body: "These Terms are governed by the laws of Mexico.",
      },
      {
        heading: "Contact",
        body: "Questions about these Terms? Email m.lopz.montn@gmail.com.",
      },
    ],
  },
  es: {
    title: "Términos de Servicio",
    lastUpdated: "Última actualización: 10 de agosto de 2026",
    sections: [
      {
        heading: "Aceptación de los términos",
        body: "Al crear una cuenta de BoxBuddy, aceptas estos Términos de Servicio. Si no estás de acuerdo, por favor no uses BoxBuddy.",
      },
      {
        heading: "Tu cuenta",
        body: "Eres responsable de mantener la confidencialidad de tus credenciales de cuenta y de toda actividad que ocurra bajo tu cuenta. Debes proporcionar información precisa al crear tu cuenta.",
      },
      {
        heading: "Suscripciones y facturación",
        body: "BoxBuddy ofrece un plan gratuito (hasta 50 artículos) y planes pagados BoxBuddy Pro (Mensual, Anual y De por vida) con límites de artículos más altos o ilimitados e impresión de etiquetas de código de barras. Las suscripciones pagadas se facturan y procesan a través de RevenueCat y Stripe, y se renuevan automáticamente hasta que se cancelen. Puedes administrar o cancelar tu suscripción en cualquier momento desde la página de Configuración en la app, o escribiendo a m.lopz.montn@gmail.com. No ofrecemos reembolsos por períodos de facturación parciales, excepto cuando lo exija la ley.",
      },
      {
        heading: "Uso aceptable",
        body: "Aceptas no usar BoxBuddy para ningún propósito ilegal, no intentar acceder a los datos de otro usuario y no interferir con el funcionamiento normal del servicio.",
      },
      {
        heading: "Disponibilidad del servicio",
        body: 'BoxBuddy se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas. No garantizamos que el servicio esté libre de interrupciones o errores, ni que esté disponible en todo momento.',
      },
      {
        heading: "Limitación de responsabilidad",
        body: "En la máxima medida permitida por la ley, BoxBuddy y su operador no son responsables de daños indirectos, incidentales o consecuentes derivados del uso del servicio, incluida la pérdida de datos.",
      },
      {
        heading: "Terminación",
        body: "Podemos suspender o cancelar tu acceso a BoxBuddy si violas estos Términos. Puedes dejar de usar BoxBuddy y cancelar tu suscripción en cualquier momento.",
      },
      {
        heading: "Cambios a estos términos",
        body: "Podemos actualizar estos Términos de vez en cuando. El uso continuado de BoxBuddy después de publicar cambios constituye la aceptación de los Términos actualizados.",
      },
      {
        heading: "Ley aplicable",
        body: "Estos Términos se rigen por las leyes de México.",
      },
      {
        heading: "Contacto",
        body: "¿Preguntas sobre estos Términos? Escribe a m.lopz.montn@gmail.com.",
      },
    ],
  },
};

export default function TermsPage() {
  const locale = getLocale();
  const { title, lastUpdated, sections } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="text-xs text-stone-400">{lastUpdated}</p>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-stone-800">{section.heading}</h2>
          <p className="text-sm text-stone-600">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
