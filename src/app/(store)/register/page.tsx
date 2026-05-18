import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description:
    "Regístrate en ElektrK para acceder a precios exclusivos, historial de pedidos y soporte técnico especializado en componentes eléctricos.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
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
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Inicia sesión
            </Link>
          </p>
        </div>

        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
