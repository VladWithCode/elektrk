import type { Product, FilterState, Poles, TripCurve } from "@/types/product";

export function applyFilters(
  products: Product[],
  filters: FilterState
): Product[] {
  let result = products;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        String(p.amperage).includes(q)
    );
  }
  if (filters.brand.length)
    result = result.filter((p) => filters.brand.includes(p.brand));
  if (filters.amperage.length)
    result = result.filter((p) => filters.amperage.includes(p.amperage));
  if (filters.poles.length)
    result = result.filter((p) => filters.poles.includes(p.poles as Poles));
  if (filters.voltage.length)
    result = result.filter((p) => filters.voltage.includes(p.voltage));
  if (filters.tripCurve.length)
    result = result.filter((p) =>
      filters.tripCurve.includes(p.tripCurve as TripCurve)
    );

  return [...result].sort((a, b) => {
    switch (filters.sortBy) {
      case "name_asc":
        return a.name.localeCompare(b.name, "es");
      case "price_asc":
        return (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0);
      case "price_desc":
        return (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0);
      case "stock_desc":
        return b.stock - a.stock;
      default:
        return 0;
    }
  });
}
