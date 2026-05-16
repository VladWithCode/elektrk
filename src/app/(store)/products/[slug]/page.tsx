import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Zap } from "lucide-react";
import { getProductBySlug, getProducts, getAllProductSlugs } from "@/lib/repositories/products";
import { ProductVariantSelector } from "@/components/products/ProductVariantSelector";
import { ProductCard } from "@/components/products/ProductCard";
import { DatasheetButton } from "@/components/shared/DatasheetButton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SPEC_LABELS } from "@/lib/constants";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return {
      title: "Producto no encontrado",
      description: "El producto que buscas no existe o ya no está disponible en ElektrK.",
    };
  }

  const title = product.metaTitle ?? product.name;
  const description =
    product.metaDescription ??
    product.shortDescription ??
    product.description.slice(0, 160);

  const ogImages = product.metaImage
    ? [{ url: product.metaImage, alt: product.name }]
    : product.images[0] && !product.images[0].includes("placeholder")
      ? [{ url: product.images[0], alt: product.name }]
      : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImages.length > 0 && { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const [product, allProducts] = await Promise.all([
    getProductBySlug(slug),
    getProducts(),
  ]);
  if (!product) notFound();

  const related = allProducts
    .filter((p) => p.id !== product.id && (p.brand === product.brand || p.poles === product.poles))
    .slice(0, 4);

  const specs: [string, string | number][] = [
    ["brand", product.brand],
    ["model", product.model],
    ["amperage", `${product.amperage} A`],
    ["poles", `${product.poles} ${product.poles === 1 ? "polo" : "polos"}`],
    ["voltage", `${product.voltage} V`],
    ["tripCurve", `Curva ${product.tripCurve}`],
    ["category", product.category],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/products" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Catálogo
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{product.name}</span>
      </nav>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        {/* Product image */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-square rounded-2xl bg-muted overflow-hidden border border-border">
            {product.featured && (
              <Badge className="absolute top-4 left-4 z-10 gap-1">
                <Zap className="h-3 w-3" /> Destacado
              </Badge>
            )}
            {product.images[0] && !product.images[0].includes("placeholder") ? (
              <Image
                src={product.images[0]}
                alt={`${product.brand} ${product.name}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className="object-contain p-8"
              />
            ) : (
              /* Fallback visual — shown when no real image is available */
              <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <div className="w-24 h-36 bg-primary/20 rounded-lg border-2 border-primary/30 flex items-center justify-center">
                  <Zap className="h-12 w-12 text-primary/50" />
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: product.poles }).map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded-sm bg-primary/30" />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DatasheetButton
            url={product.datasheetUrl}
            filename={product.datasheetFilename}
            mimeType={product.datasheetMimeType}
            productName={product.name}
            className="w-full"
          />
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{product.brand}</p>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
              {product.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">{product.model}</p>
          </div>

          {/* Spec pills */}
          <div className="flex flex-wrap gap-2">
            {[
              `${product.amperage}A`,
              `${product.poles}P`,
              `${product.voltage}V`,
              `Curva ${product.tripCurve}`,
            ].map((spec) => (
              <span
                key={spec}
                className="px-2.5 py-1 rounded-full bg-muted text-xs font-mono font-medium text-muted-foreground"
              >
                {spec}
              </span>
            ))}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description}
          </p>

          <Separator />

          {/* Variant selector (client component) */}
          <ProductVariantSelector product={product} />
        </div>
      </div>

      {/* Specs table */}
      <div className="mt-16">
        <SectionHeader title="Especificaciones técnicas" className="mb-4" />
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {specs.map(([key, val], i) => (
                <tr
                  key={key}
                  className={i % 2 === 0 ? "bg-muted/40" : "bg-card"}
                >
                  <td className="px-4 py-3 font-medium text-muted-foreground w-40 sm:w-52">
                    {SPEC_LABELS[key] ?? key}
                  </td>
                  <td className="px-4 py-3 text-foreground font-mono">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="mt-16">
          <SectionHeader
            title="Productos relacionados"
            subtitle="De la misma marca o configuración similar"
            className="mb-6"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
