import type { Metadata } from "next";
import Link from "next/link";
import { User, Package, Ticket, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { formatCurrency } from "@/lib/currency";
import { getSessionSafe, isAuthConfigured } from "@/lib/auth/helpers";
import { getAccountDashboard } from "@/lib/repositories/account";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/types/order";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProfileEditSection } from "@/components/account/ProfileEditSection";
import { ChangePasswordSection } from "@/components/account/ChangePasswordSection";
import { AddressesSection } from "@/components/account/AddressesSection";
import { getMyAddresses } from "@/app/(store)/account/address-actions";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description:
    "Gestiona tu perfil, consulta el historial de órdenes y accede a los tickets de soporte de tu cuenta ElektrK.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await getSessionSafe();
  const [dashboard, savedAddresses] = await Promise.all([
    getAccountDashboard(session?.user ?? null),
    getMyAddresses(),
  ]);

  const { user, recentOrders, stats, isDemoMode } = dashboard;
  const authReady = isAuthConfigured();

  const displayName = user.name ?? (isDemoMode ? "Usuario de prueba" : "–");
  const displayEmail = user.email ?? (isDemoMode ? "usuario@ejemplo.com" : "–");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <SectionHeader title="Mi cuenta" className="mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar nav */}
        <nav className="space-y-1">
          {[
            { icon: User,    label: "Perfil",      href: "/account",         active: true  },
            { icon: Package, label: "Mis órdenes", href: "/account/orders",  active: false },
            { icon: Ticket,  label: "Mis tickets", href: "/support/tickets", active: false },
          ].map(({ icon: Icon, label, href, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <Separator className="my-2" />
          <LogoutButton callbackUrl="/login" />
        </nav>

        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Demo mode banner */}
          {isDemoMode && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <strong>Modo demo:</strong> Auth.js requiere base de datos configurada para sesiones reales.
              {!authReady && (
                <> Sigue{" "}
                  <Link href="/docs/NEON_SETUP.md" className="underline">NEON_SETUP.md</Link>
                  {" "}para conectar Neon.</>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Órdenes",          value: String(stats.totalOrders) },
              { label: "Tickets abiertos", value: String(stats.openTickets) },
              { label: "Total gastado",    value: stats.totalSpent > 0 ? formatCurrency(stats.totalSpent) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xl font-bold text-card-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Profile card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-card-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              {!isDemoMode
                ? "Sesión activa. Los datos se cargan desde Auth.js."
                : "Conecta Neon y configura AUTH_SECRET para activar sesiones reales."}
            </p>
            <ProfileEditSection currentName={user.name ?? null} />
          </div>

          {/* Change password */}
          {!isDemoMode && <ChangePasswordSection />}

          {/* Saved addresses */}
          {!isDemoMode && <AddressesSection initialAddresses={savedAddresses} />}

          {/* Recent orders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Órdenes recientes</h2>
              <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                <Link href="/account/orders">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aún no tienes órdenes registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card gap-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{order.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.displayDate} · {order.itemCount}{" "}
                          {order.itemCount === 1 ? "producto" : "productos"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status] ?? "outline"}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-sm font-semibold text-card-foreground">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
