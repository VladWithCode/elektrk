import type { Product, FilterState, Poles, TripCurve } from "@/types/product";

/** All-empty filter state. Spread this to build a complete FilterState. */
export const EMPTY_FILTER_STATE: FilterState = {
  category: [],
  brand: [],
  amperage: [],
  poles: [],
  voltage: [],
  tripCurve: [],
  gauge: [],
  dimensions: [],
  channelType: [],
  finish: [],
  boardType: [],
  nemaRating: [],
  amperageCapacity: [],
  anchorType: [],
  supportType: [],
  accessoryType: [],
  dimDiameter: [],
  dimLength: [],
  search: "",
  sortBy: "name_asc",
};

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
        (p.amperage != null && String(p.amperage).includes(q))
    );
  }
  // Primary: category
  if (filters.category.length)
    result = result.filter((p) => filters.category.includes(p.category));
  // Common
  if (filters.brand.length)
    result = result.filter((p) => filters.brand.includes(p.brand));
  // Interruptores
  if (filters.amperage.length)
    result = result.filter((p) => p.amperage != null && filters.amperage.includes(p.amperage));
  if (filters.poles.length)
    result = result.filter((p) => p.poles != null && filters.poles.includes(p.poles as Poles));
  if (filters.voltage.length)
    result = result.filter((p) => p.voltage != null && filters.voltage.includes(p.voltage));
  if (filters.tripCurve.length)
    result = result.filter((p) => p.tripCurve != null && filters.tripCurve.includes(p.tripCurve as TripCurve));
  // Unicanal
  if (filters.gauge.length)
    result = result.filter((p) => p.gauge != null && filters.gauge.includes(p.gauge));
  if (filters.dimensions.length)
    result = result.filter((p) => p.dimensions != null && filters.dimensions.includes(p.dimensions));
  if (filters.channelType.length)
    result = result.filter((p) => p.channelType != null && filters.channelType.includes(p.channelType));
  if (filters.finish.length)
    result = result.filter((p) => p.finish != null && filters.finish.includes(p.finish));
  // Gabinetes y tableros
  if (filters.boardType.length)
    result = result.filter((p) => p.boardType != null && filters.boardType.includes(p.boardType));
  if (filters.nemaRating.length)
    result = result.filter((p) => p.nemaRating != null && filters.nemaRating.includes(p.nemaRating));
  if (filters.amperageCapacity.length)
    result = result.filter((p) => p.amperageCapacity != null && filters.amperageCapacity.includes(p.amperageCapacity));
  // Fijación / Soportería / Herramientas
  if (filters.anchorType.length)
    result = result.filter((p) => p.anchorType != null && filters.anchorType.includes(p.anchorType));
  if (filters.supportType.length)
    result = result.filter((p) => p.supportType != null && filters.supportType.includes(p.supportType));
  if (filters.accessoryType.length)
    result = result.filter((p) => p.accessoryType != null && filters.accessoryType.includes(p.accessoryType));
  if (filters.dimDiameter.length)
    result = result.filter((p) => p.dimDiameter != null && filters.dimDiameter.includes(p.dimDiameter));
  if (filters.dimLength.length)
    result = result.filter((p) => p.dimLength != null && filters.dimLength.includes(p.dimLength));

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
