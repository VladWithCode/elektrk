import type { Metadata } from "next";

/**
 * Layout for /support/tickets
 *
 * tickets/page.tsx is a "use client" component (uses useState for form
 * interactivity), so it cannot export `metadata` directly. This layout
 * acts as the metadata owner for the route while leaving the page untouched.
 */
export const metadata: Metadata = {
  title: "Mis tickets de soporte",
  description:
    "Consulta el estado de tus tickets, abre nuevas solicitudes y da seguimiento a la asistencia técnica de tu cuenta ElektrK.",
  robots: { index: false, follow: false },
};

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
