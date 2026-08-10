// app/privacy/page.tsx
import { getLocale } from "../../lib/i18n/server";
import type { Locale } from "../../lib/i18n/types";

type Section = { heading: string; body: string };

const content: Record<Locale, { title: string; sections: Section[] }> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Overview",
        body: "This Privacy Policy explains what information BoxBuddy collects, how it's used, and your rights regarding that information. BoxBuddy is a small, independently-run inventory tracking service — by using it, you agree to the practices described here.",
      },
      {
        heading: "Information We Collect",
        body: "When you create a BoxBuddy account, we collect your email address and password (managed securely by Supabase Auth — we never see your password in plain text). As you use the app, we store the inventory data you enter: item names, quantities, locations, categories, costs, prices, notes, and any photos you upload. If you subscribe to BoxBuddy Pro, RevenueCat and Stripe process your payment and subscription information; BoxBuddy itself never sees or stores your payment card details.",
      },
      {
        heading: "How We Use Your Information",
        body: "We use this information solely to provide the BoxBuddy service to you: authenticating your account, storing and displaying your inventory, processing subscription payments, and communicating with you about your account when necessary. We do not sell your information to third parties.",
      },
      {
        heading: "Third-Party Services",
        body: "BoxBuddy relies on three third-party services to operate: Supabase (authentication and database hosting), RevenueCat (subscription management), and Stripe (payment processing). Each of these providers has its own privacy policy governing how they handle your data.",
      },
      {
        heading: "Data Retention",
        body: "Your account data is retained for as long as your account exists. If you'd like your account and its data deleted, email us at m.lopz.montn@gmail.com and we'll process the request.",
      },
      {
        heading: "Cookies",
        body: "BoxBuddy uses two cookies: one to keep you signed in (managed by Supabase Auth), and one to remember your chosen language (English or Spanish). Neither is used for advertising or tracking.",
      },
      {
        heading: "Your Rights",
        body: "You may request access to, correction of, or deletion of your personal data at any time by emailing m.lopz.montn@gmail.com.",
      },
      {
        heading: "Changes to This Policy",
        body: "We may update this Privacy Policy from time to time. Continued use of BoxBuddy after changes are posted constitutes acceptance of the updated policy.",
      },
      {
        heading: "Governing Law",
        body: "This Privacy Policy is governed by the laws of Mexico.",
      },
      {
        heading: "Contact",
        body: "Questions about this policy? Email m.lopz.montn@gmail.com.",
      },
    ],
  },
  es: {
    title: "Política de Privacidad",
    sections: [
      {
        heading: "Resumen",
        body: "Esta Política de Privacidad explica qué información recopila BoxBuddy, cómo se usa y cuáles son tus derechos sobre esa información. BoxBuddy es un servicio de seguimiento de inventario pequeño y de gestión independiente — al usarlo, aceptas las prácticas descritas aquí.",
      },
      {
        heading: "Información que recopilamos",
        body: "Cuando creas una cuenta de BoxBuddy, recopilamos tu correo electrónico y contraseña (gestionados de forma segura por Supabase Auth — nunca vemos tu contraseña en texto plano). Mientras usas la app, almacenamos los datos de inventario que ingresas: nombres de artículos, cantidades, ubicaciones, categorías, costos, precios, notas y cualquier foto que subas. Si te suscribes a BoxBuddy Pro, RevenueCat y Stripe procesan tu información de pago y suscripción; BoxBuddy nunca ve ni almacena los datos de tu tarjeta de pago.",
      },
      {
        heading: "Cómo usamos tu información",
        body: "Usamos esta información únicamente para brindarte el servicio de BoxBuddy: autenticar tu cuenta, almacenar y mostrar tu inventario, procesar pagos de suscripción y comunicarnos contigo sobre tu cuenta cuando sea necesario. No vendemos tu información a terceros.",
      },
      {
        heading: "Servicios de terceros",
        body: "BoxBuddy depende de tres servicios de terceros para funcionar: Supabase (autenticación y alojamiento de base de datos), RevenueCat (gestión de suscripciones) y Stripe (procesamiento de pagos). Cada uno de estos proveedores tiene su propia política de privacidad que rige cómo manejan tus datos.",
      },
      {
        heading: "Retención de datos",
        body: "Los datos de tu cuenta se conservan mientras tu cuenta exista. Si deseas que eliminemos tu cuenta y sus datos, escríbenos a m.lopz.montn@gmail.com y procesaremos la solicitud.",
      },
      {
        heading: "Cookies",
        body: "BoxBuddy usa dos cookies: una para mantener tu sesión iniciada (gestionada por Supabase Auth) y otra para recordar el idioma que elegiste (inglés o español). Ninguna se usa para publicidad ni rastreo.",
      },
      {
        heading: "Tus derechos",
        body: "Puedes solicitar acceso, corrección o eliminación de tus datos personales en cualquier momento escribiendo a m.lopz.montn@gmail.com.",
      },
      {
        heading: "Cambios a esta política",
        body: "Podemos actualizar esta Política de Privacidad de vez en cuando. El uso continuado de BoxBuddy después de publicar cambios constituye la aceptación de la política actualizada.",
      },
      {
        heading: "Ley aplicable",
        body: "Esta Política de Privacidad se rige por las leyes de México.",
      },
      {
        heading: "Contacto",
        body: "¿Preguntas sobre esta política? Escribe a m.lopz.montn@gmail.com.",
      },
    ],
  },
};

export default function PrivacyPage() {
  const locale = getLocale();
  const { title, sections } = content[locale];
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-stone-800">{section.heading}</h2>
          <p className="text-sm text-stone-600">{section.body}</p>
        </section>
      ))}
    </main>
  );
}
