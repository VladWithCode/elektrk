import type { Metadata } from "next";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CatalogClient } from "@/components/products/CatalogClient";
import { getProducts, getProductFilters } from "@/lib/repositories/products";

export const metadata: Metadata = {
  title: "Catálogo de Productos",
  description:
    "Explora nuestro catálogo de interruptores termomagnéticos y componentes eléctricos. Filtra por marca, amperaje, polos o curva de disparo. Siemens, ABB y Schneider Electric.",
  openGraph: {
    title: "Catálogo — ElektrK",
    description:
      "Interruptores termomagnéticos de las mejores marcas. Filtra por amperage, polos y curva de disparo.",
    type: "website",
  },
};

export default async function CatalogPage() {
  const [products, filterOptions] = await Promise.all([
    getProducts(),
    getProductFilters(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <SectionHeader
        title="Catálogo"
        subtitle="Interruptores termomagnéticos y componentes eléctricos"
        className="mb-6"
      />
      <CatalogClient products={products} filterOptions={filterOptions} />
    </div>
  );
}
