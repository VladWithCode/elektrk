import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getSessionSafe } from "@/lib/auth/helpers";
import { getTicketsByCustomer } from "@/lib/repositories/tickets";
import { TicketsClient } from "@/components/support/TicketsClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mis tickets",
  description: "Gestiona tus tickets de soporte técnico en ElektrK.",
  robots: { index: false, follow: false },
};

export default async function TicketsPage() {
  const session = await getSessionSafe();

  // Not authenticated — show login prompt
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <EmptyState
          icon={AlertCircle}
          title="Inicia sesión para acceder a tus tickets"
          description="Necesitas autenticarte para crear y ver tus tickets de soporte."
          action={
            <Button asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Fetch real tickets for this user
  const customerAuthId = session.user.id ?? "";
  const customerEmail = session.user.email || "usuario@example.com";
  const tickets = await getTicketsByCustomer(customerAuthId);

  return (
    <TicketsClient
      initialTickets={tickets}
      userEmail={customerEmail}
      userAuthId={customerAuthId}
    />
  );
}
