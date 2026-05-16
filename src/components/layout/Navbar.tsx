"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X, Search, User, LogOut } from "lucide-react";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "@/context/CartContext";
import { ThemeToggle } from "./ThemeToggle";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/products", label: "Catálogo" },
  { href: "/support", label: "Soporte" },
];

// ---------------------------------------------------------------------------
// Auth section — shows login/register or user menu depending on session state
// ---------------------------------------------------------------------------

function NavbarAuthDesktop() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // Skeleton to prevent layout shift while session loads
    return (
      <div className="h-8 w-24 rounded-md bg-muted/50 animate-pulse" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/account">
            <User className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate text-xs">
              {session.user.name ?? session.user.email ?? "Mi cuenta"}
            </span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          aria-label="Cerrar sesión"
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">Salir</span>
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild className="ml-1">
      <Link href="/login">Iniciar sesión</Link>
    </Button>
  );
}

function NavbarAuthMobile({ onClose }: { onClose: () => void }) {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (session?.user) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <Button variant="ghost" size="sm" asChild className="justify-start gap-2">
          <Link href="/account" onClick={onClose}>
            <User className="h-4 w-4" />
            {session.user.name ?? session.user.email ?? "Mi cuenta"}
          </Link>
        </Button>
        <button
          type="button"
          onClick={() => { onClose(); signOut({ callbackUrl: "/" }); }}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild className="flex-1">
      <Link href="/login" onClick={onClose}>
        Iniciar sesión
      </Link>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function Navbar() {
  const pathname = usePathname();
  const { totalItems, openDrawer } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <BrandLogo />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 ml-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Buscar" asChild>
            <Link href="/products">
              <Search className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label={totalItems > 0 ? `Carrito (${totalItems} ${totalItems === 1 ? "producto" : "productos"})` : "Carrito"}
            className="relative"
            onClick={openDrawer}
          >
            <ShoppingCart className="h-4 w-4" />
            {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
              >
                {totalItems > 9 ? "9+" : totalItems}
              </motion.span>
            )}
          </Button>
          <NavbarAuthDesktop />
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={openDrawer}
            aria-label={totalItems > 0 ? `Carrito (${totalItems} ${totalItems === 1 ? "producto" : "productos"})` : "Carrito"}
          >
            <ShoppingCart className="h-4 w-4" />
            {totalItems > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menú"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                <ThemeToggle />
                <NavbarAuthMobile onClose={() => setMobileOpen(false)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
