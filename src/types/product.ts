export type TripCurve = "B" | "C" | "D";
export type Poles = 1 | 2 | 3 | 4;
export type VariantType = "piece" | "box" | "lot";

export type ProductCategory =
  | "interruptores"
  | "gabinetes_tableros"
  | "unicanal"
  | "fijacion"
  | "soporteria"
  | "herramientas_accesorios";

/** Human-readable labels for each category (Spanish). */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  interruptores: "Interruptores termomagnéticos",
  gabinetes_tableros: "Gabinetes y tableros",
  unicanal: "Unicanal galvanizado",
  fijacion: "Sistemas de fijación",
  soporteria: "Soportería",
  herramientas_accesorios: "Herramientas y accesorios",
};
// OrderStatus and OrderSummary moved to src/types/order.ts (Phase 10A).
// Re-exported here for backwards compatibility.
export type { OrderStatus, OrderSummary } from "@/types/order";

// TicketStatus and MockTicket moved to src/types/ticket.ts (Phase 9A).
// Re-exported here for backwards compatibility with any remaining imports.
export type { TicketStatus } from "@/types/ticket";

export interface ProductVariant {
  sku: string;
  type: VariantType;
  label: string;
  price: number;
  unitsPerPackage: number;
  stock: number;
  /** Exact spec that differentiates this SKU (e.g. "63 A", "Calibre 14 · 4×2\""). */
  variantSpec?: string | null;
  presentation?: string | null;
  unitLabel?: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: ProductCategory;
  /** Manufacturer line/series. Ej. I-LINE, ED63B, NF. */
  productLine?: string | null;
  description: string;
  /** Short one-liner for catalog cards and preview snippets */
  shortDescription?: string | null;
  /** Additional technical notes shown in the product detail specs section */
  technicalSummary?: string | null;
  // --- Interruptores (optional — only present for category "interruptores") ---
  amperage?: number | null;
  poles?: Poles | null;
  voltage?: number | null;
  tripCurve?: TripCurve | null;
  interruptingCapacity?: number | null;
  mountingType?: string | null;
  breakerType?: string | null;
  frame?: string | null;
  // --- Gabinetes y tableros ---
  boardType?: string | null;
  nemaRating?: string | null;
  amperageCapacity?: number | null;
  enclosureUse?: string | null;
  spaces?: number | null;
  circuits?: number | null;
  compatibleBreakerLine?: string | null;
  // --- Unicanal ---
  channelType?: string | null;
  gauge?: string | null;
  dimensions?: string | null;
  length?: string | null;
  finish?: string | null;
  customLengthAvailable?: boolean | null;
  // --- Fijación / Soportería / Herramientas (shared + specific) ---
  anchorType?: string | null;
  boxQuantity?: number | null;
  supportType?: string | null;
  compatibleWithUnicanal?: boolean | null;
  accessoryType?: string | null;
  compatibleTool?: string | null;
  application?: string | null;
  presentation?: string | null;
  material?: string | null;
  dimDiameter?: string | null;
  dimLength?: string | null;
  stock: number;
  images: string[];
  datasheetUrl: string | null;
  /** Original filename of the datasheet (e.g. "siemens-5sl6110-7.pdf"). Used as the `download` attribute. */
  datasheetFilename?: string | null;
  /** MIME type of the datasheet media item. Validated to be "application/pdf" before rendering the button. */
  datasheetMimeType?: string | null;
  variants: ProductVariant[];
  featured?: boolean;
  tags?: string[];
  /** SEO overrides — fall back to name/description when absent */
  metaTitle?: string | null;
  metaDescription?: string | null;
  /** Absolute URL to the OG image for this product */
  metaImage?: string | null;
}

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  brand: string;
  variantSku: string;
  variantType: VariantType;
  variantLabel: string;
  price: number;
  quantity: number;
  stock: number;
  image: string;
}

// MockTicket moved to src/types/ticket.ts as Ticket (Phase 9A).

// OrderSummary and UserAccount moved to src/types/order.ts and src/types/account.ts (Phase 10A).
// AccountUser is the replacement for UserAccount.

export interface FilterState {
  // Primary facet — drives which category-specific facets are shown.
  category: ProductCategory[];
  brand: string[];
  // Interruptores
  amperage: number[];
  poles: Poles[];
  voltage: number[];
  tripCurve: TripCurve[];
  // Unicanal
  gauge: string[];
  dimensions: string[];
  channelType: string[];
  finish: string[];
  // Gabinetes y tableros
  boardType: string[];
  nemaRating: string[];
  amperageCapacity: number[];
  // Fijación / Soportería / Herramientas
  anchorType: string[];
  supportType: string[];
  accessoryType: string[];
  dimDiameter: string[];
  dimLength: string[];
  search: string;
  sortBy: "name_asc" | "price_asc" | "price_desc" | "stock_desc";
}
