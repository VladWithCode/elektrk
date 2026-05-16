import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, ArrowRight, LifeBuoy, BookOpen, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Centro de soporte",
  description:
    "¿Tienes dudas sobre un pedido o necesitas asistencia técnica? Abre un ticket, consulta preguntas frecuentes o contáctanos directamente. El equipo de ElektrK está aquí para ayudarte.",
  openGraph: {
    title: "Centro de soporte — ElektrK",
    description:
      "Soporte técnico y atención al cliente para distribución de componentes eléctricos. Tickets con seguimiento en línea.",
    type: "website",
  },
};

const HELP_TOPICS = [
  {
    icon: MessageSquare,
    title: "Abrir un ticket",
    description:
      "¿Problema con un pedido, producto o entrega? Abre un ticket y te respondemos en menos de 24 h.",
    href: "/support/tickets",
    cta: "Ir a tickets",
  },
  {
    icon: BookOpen,
    title: "Guías técnicas",
    description:
      "Consulta fichas técnicas, manuales de instalación y notas de aplicación de nuestros productos.",
    href: "/products",
    cta: "Ver productos",
  },
  {
    icon: Phone,
    title: "Contacto directo",
    description:
      "Para cotizaciones de volumen o asesoría técnica especializada, contáctanos directamente.",
    href: "mailto:ventas@elektrk.mx",
    cta: "Enviar correo",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Centro de soporte
        </h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Estamos aquí para ayudarte. Elige la opción que mejor se adapte a tu
          necesidad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {HELP_TOPICS.map(({ icon: Icon, title, description, href, cta }) => (
          <div
            key={title}
            className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-card-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
            <Button variant="outline" asChild className="gap-2 w-full">
              <Link href={href}>
                {cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
