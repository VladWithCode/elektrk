import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description:
    "Accede a tu cuenta de Distribuidor Electrico Monterrey para consultar pedidos, descargar facturas y gestionar tickets de soporte.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 font-heading font-bold text-xl">
              <Zap className="h-5 w-5 text-primary" />
              <span>
                Elektr<span className="text-primary">K</span>
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              Regístrate gratis
            </Link>
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
