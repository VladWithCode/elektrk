import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap, ShieldCheck, Truck, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { getFeaturedProducts } from "@/lib/repositories/products";

export const metadata: Metadata = {
  title: "D.E. MTY — Interruptores Termomagnéticos y Componentes Eléctricos",
  description:
    "Distribuidora especializada en interruptores termomagnéticos, breakers y protecciones eléctricas de Siemens, ABB y Schneider Electric. Venta por pieza, caja o lote con IVA incluido. Envío a toda la república.",
  openGraph: {
    title: "D.E. MTY — Interruptores Termomagnéticos y Componentes Eléctricos",
    description:
      "Distribuidora especializada en breakers e interruptores. Siemens, ABB y Schneider Electric. Precios con IVA incluido.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "D.E. MTY — Componentes Eléctricos",
    description:
      "Interruptores termomagnéticos de Siemens, ABB y Schneider Electric. Venta por pieza, caja o lote.",
  },
};

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Productos certificados",
    description: "Solo marcas líderes: Siemens, ABB y Schneider Electric.",
  },
  {
    icon: Truck,
    title: "Envío a tarifa plana",
    description: "Un solo costo de envío sin importar el tamaño del pedido.",
  },
  {
    icon: Zap,
    title: "Stock en tiempo real",
    description: "Disponibilidad actualizada al momento de tu compra.",
  },
  {
    icon: Headphones,
    title: "Soporte técnico",
    description: "Tickets de soporte con seguimiento en línea.",
  },
];

export default async function HomePage() {
  const featured = await getFeaturedProducts();
  return (
    <div className="flex flex-col gap-20 pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-4 gap-1.5 text-xs">
              <Zap className="h-3 w-3 text-primary" />
              Distribución especializada
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight text-foreground leading-tight">
              Componentes eléctricos para{" "}
              <span className="text-primary">profesionales</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
              Interruptores termomagnéticos y protecciones eléctricas de las
              mejores marcas. Venta por pieza, caja o lote con precios IVA
              incluido.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild className="gap-2">
                <Link href="/products">
                  Ver catálogo completo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/support">Centro de soporte</Link>
              </Button>
            </div>
          </div>
        </div>
        {/* Decorative element */}
        <div
          aria-hidden
          className="absolute right-0 top-0 h-full w-1/2 opacity-5 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 70% 50%, oklch(0.52 0.105 223.128), transparent 60%)",
          }}
        />
      </section>

      {/* Features */}
      <AnimatedSection>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Featured products */}
      <AnimatedSection delay={0.1}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Productos destacados"
            subtitle="Los más solicitados por nuestros clientes"
            action={
              <Button variant="outline" asChild className="gap-2">
                <Link href="/products">
                  Ver todos <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
            className="mb-6"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Brands */}
      <AnimatedSection delay={0.05}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-muted-foreground mb-8 uppercase tracking-widest">
            Marcas distribuidas
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {["Siemens", "ABB", "Schneider Electric"].map((brand) => (
              <Link
                key={brand}
                href={`/products?brand=${encodeURIComponent(brand)}`}
                className="text-xl font-heading font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
