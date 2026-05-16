export type TripCurve = "B" | "C" | "D";
export type Poles = 1 | 2 | 3 | 4;
export type VariantType = "piece" | "box" | "lot";
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
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  /** Short one-liner for catalog cards and preview snippets */
  shortDescription?: string | null;
  /** Additional technical notes shown in the product detail specs section */
  technicalSummary?: string | null;
  amperage: number;
  poles: Poles;
  voltage: number;
  tripCurve: TripCurve;
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
  amperage: number[];
  poles: Poles[];
  voltage: number[];
  tripCurve: TripCurve[];
  brand: string[];
  category: string[];
  search: string;
  sortBy: "name_asc" | "price_asc" | "price_desc" | "stock_desc";
}
