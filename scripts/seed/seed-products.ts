/**
 * Seed script — inserta MOCK_PRODUCTS en Payload CMS
 *
 * PRERREQUISITOS (ejecutar en orden):
 *   1. DATABASE_URL_UNPOOLED configurado en .env.local
 *   2. bun run db:extensions
 *   3. bun run db:auth:migrate
 *   4. bun run payload:migrate
 *   5. Entrar a /admin y crear el primer admin (si aún no existe)
 *
 * EJECUCIÓN:
 *   bun scripts/seed/seed-products.ts
 *
 * IDEMPOTENCIA:
 *   - Usa `slug` como clave de existencia para productos.
 *   - Si un producto existe, se omite junto con sus variantes (el bloque
 *     `continue` salta toda la lógica de ese producto).
 *   - Limitación: si un producto fue creado parcialmente (producto OK,
 *     variante falló a mitad), el segundo run lo omite completo.
 *     En ese caso, eliminar el producto desde /admin antes de re-seedear.
 *
 * NOTA: este archivo NO se ejecuta automáticamente. Es un utilitario manual.
 */

import { getPayload } from "payload";
import config from "../../payload.config";
import { MOCK_PRODUCTS } from "../../src/data/mock-products";

async function seed() {
  const payload = await getPayload({ config });

  console.log(`\n🌱 Seeding ${MOCK_PRODUCTS.length} products into Payload...\n`);

  let created = 0;
  let skipped = 0;

  for (const mock of MOCK_PRODUCTS) {
    // Check if product already exists
    const existing = await payload.find({
      collection: "products",
      where: { slug: { equals: mock.slug } },
      limit: 1,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      console.log(`  ⏭  Skipped (exists): ${mock.slug}`);
      skipped++;
      continue;
    }

    // Create product document
    const product = await payload.create({
      collection: "products",
      data: {
        name: mock.name,
        slug: mock.slug,
        description: mock.description,
        brand: mock.brand,
        model: mock.model,
        amperage: mock.amperage,
        // Payload select fields are stored as strings
        poles: String(mock.poles) as "1" | "2" | "3" | "4",
        voltage: mock.voltage,
        tripCurve: mock.tripCurve,
        category: mock.category,
        stock: mock.stock,
        images: [], // no media uploaded yet
        datasheet: null,
        isActive: true,
        featured: mock.featured ?? false,
      },
    });

    // Create variant documents linked to this product
    for (const variant of mock.variants) {
      await payload.create({
        collection: "variants",
        data: {
          product: product.id,
          sku: variant.sku,
          saleType: variant.type,
          unitsPerPackage: variant.unitsPerPackage,
          price: variant.price,
          stock: variant.stock,
          isActive: true,
        },
      });
    }

    console.log(`  ✅ Created: ${mock.name} (${mock.variants.length} variants)`);
    created++;
  }

  console.log(`\n✅ Done. Created: ${created} | Skipped: ${skipped}\n`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
