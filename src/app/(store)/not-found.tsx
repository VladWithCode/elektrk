import Link from "next/link";
import { Zap, Home, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La página que buscas no existe o fue movida.",
  robots: { index: false, follow: false },
};

/**
 * Storefront 404 — rendered by Next.js whenever notFound() is called or a
 * route cannot be matched within the (store) route group.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Brand mark */}
      <Link
        href="/"
        className="flex items-center gap-2 font-heading font-bold text-xl mb-12 text-foreground hover:text-primary transition-colors"
      >
        <Zap className="h-5 w-5 text-primary" />
        ElektrK
      </Link>

      {/* Error block */}
      <div className="text-center max-w-md space-y-4">
        {/* Big 404 */}
        <p className="text-8xl font-bold text-muted-foreground/30 font-heading leading-none select-none">
          404
        </p>

        <h1 className="text-2xl font-bold tracking-tight">
          Página no encontrada
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed">
          La página que buscas no existe, fue movida o el enlace está
          desactualizado. Verifica la URL o explora el catálogo desde el inicio.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ir al inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/products">
              <ShoppingBag className="h-4 w-4" />
              Ver catálogo
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer hint */}
      <p className="mt-12 text-xs text-muted-foreground">
        ¿Necesitas ayuda?{" "}
        <Link
          href="/support"
          className="underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Contáctanos
        </Link>
      </p>
    </div>
  );
}
