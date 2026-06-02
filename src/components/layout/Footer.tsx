import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getProductFilters } from "@/lib/repositories/products";

const STATIC_LINKS = {
  Soporte: [
    { href: "/support", label: "Centro de ayuda" },
    { href: "/support/tickets", label: "Mis tickets" },
  ],
  Cuenta: [
    { href: "/account", label: "Mi cuenta" },
    { href: "/login", label: "Iniciar sesión" },
    { href: "/register", label: "Registrarse" },
  ],
};

export async function Footer() {
  const { brands } = await getProductFilters();

  const catalogLinks = [
    { href: "/products", label: "Todos los productos" },
    ...brands.map((brand) => ({
      href: `/products?brand=${encodeURIComponent(brand)}`,
      label: brand,
    })),
  ];

  const footerLinks = {
    Catálogo: catalogLinks,
    ...STATIC_LINKS,
  };

  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div>
              <Link href="/">
                <BrandLogo />
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Distribuidor especializado de componentes eléctricos. Interruptores
              termomagnéticos y protecciones eléctricas industriales y residenciales.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Distribuidor Electrico Monterrey. Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Precios con IVA incluido · Envío a tarifa plana
          </p>
        </div>
      </div>
    </footer>
  );
}
