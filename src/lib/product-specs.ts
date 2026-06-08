import type { Product } from "@/types/product";

export interface SpecRow {
  label: string;
  value: string;
}

const CHANNEL_TYPE: Record<string, string> = { solido: "Sólido", perforado: "Perforado" };
const MOUNTING_TYPE: Record<string, string> = { iline: "Barra I-LINE", screw: "Tornillo / gabinete" };
const BOARD_TYPE: Record<string, string> = {
  nf: "Tablero NF", nq: "Tablero NQ", iline: "Tablero I-LINE",
  autosoportado: "Autosoportado", gabinete: "Gabinete",
};
const ENCLOSURE_USE: Record<string, string> = { interior: "Interior", intemperie: "Intemperie" };

function push(rows: SpecRow[], label: string, value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") return;
  rows.push({ label, value: `${value}${suffix}` });
}

/**
 * Full spec table for the product-detail page, built per category.
 * Only includes fields that are present (non-null), so non-breaker products
 * never show empty breaker rows and vice-versa.
 */
export function getProductSpecs(product: Product): SpecRow[] {
  const rows: SpecRow[] = [];
  if (product.productLine) push(rows, "Línea / Serie", product.productLine);

  switch (product.category) {
    case "interruptores":
      push(rows, "Amperaje", product.amperage, " A");
      if (product.poles != null)
        push(rows, "Polos", `${product.poles} ${product.poles === 1 ? "polo" : "polos"}`);
      push(rows, "Voltaje", product.voltage, " V");
      if (product.tripCurve) push(rows, "Curva de disparo", `Curva ${product.tripCurve}`);
      push(rows, "Capacidad interruptiva", product.interruptingCapacity, " kA");
      if (product.mountingType) push(rows, "Montaje", MOUNTING_TYPE[product.mountingType] ?? product.mountingType);
      push(rows, "Tipo", product.breakerType);
      push(rows, "Frame", product.frame);
      break;
    case "gabinetes_tableros":
      if (product.boardType) push(rows, "Tipo", BOARD_TYPE[product.boardType] ?? product.boardType);
      if (product.nemaRating) push(rows, "NEMA", product.nemaRating.toUpperCase());
      push(rows, "Capacidad", product.amperageCapacity, " A");
      if (product.enclosureUse) push(rows, "Uso", ENCLOSURE_USE[product.enclosureUse] ?? product.enclosureUse);
      push(rows, "Espacios", product.spaces);
      push(rows, "Circuitos", product.circuits);
      push(rows, "Interruptor compatible", product.compatibleBreakerLine);
      break;
    case "unicanal":
      if (product.channelType) push(rows, "Tipo", CHANNEL_TYPE[product.channelType] ?? product.channelType);
      if (product.gauge) push(rows, "Calibre", `Calibre ${product.gauge}`);
      push(rows, "Medida", product.dimensions);
      push(rows, "Largo", product.length);
      push(rows, "Acabado", product.finish);
      if (product.customLengthAvailable) push(rows, "Largo a la medida", "Disponible");
      break;
    case "fijacion":
      push(rows, "Tipo de anclaje", product.anchorType);
      push(rows, "Diámetro", product.dimDiameter);
      push(rows, "Largo", product.dimLength);
      push(rows, "Material", product.material);
      push(rows, "Aplicación", product.application);
      push(rows, "Piezas por caja", product.boxQuantity);
      break;
    case "soporteria":
      push(rows, "Tipo de soporte", product.supportType);
      push(rows, "Diámetro", product.dimDiameter);
      push(rows, "Largo", product.dimLength);
      push(rows, "Material", product.material);
      push(rows, "Acabado", product.finish);
      if (product.compatibleWithUnicanal) push(rows, "Compatible con unicanal", "Sí");
      break;
    case "herramientas_accesorios":
      push(rows, "Tipo", product.accessoryType);
      push(rows, "Herramienta compatible", product.compatibleTool);
      push(rows, "Diámetro", product.dimDiameter);
      push(rows, "Largo", product.dimLength);
      push(rows, "Aplicación", product.application);
      push(rows, "Presentación", product.presentation);
      break;
  }
  return rows;
}

/**
 * Compact pills for the product card. Short, category-aware, never "undefinedA".
 * Returns at most 4 short tokens.
 */
export function getProductPills(product: Product): string[] {
  const pills: string[] = [];
  switch (product.category) {
    case "interruptores":
      if (product.amperage != null) pills.push(`${product.amperage}A`);
      if (product.poles != null) pills.push(`${product.poles}P`);
      if (product.voltage != null) pills.push(`${product.voltage}V`);
      if (product.tripCurve) pills.push(`Curva ${product.tripCurve}`);
      break;
    case "gabinetes_tableros":
      if (product.boardType) pills.push(BOARD_TYPE[product.boardType] ?? product.boardType);
      if (product.nemaRating) pills.push(`NEMA ${product.nemaRating.toUpperCase()}`);
      if (product.amperageCapacity != null) pills.push(`${product.amperageCapacity}A`);
      break;
    case "unicanal":
      if (product.gauge) pills.push(`Cal. ${product.gauge}`);
      if (product.dimensions) pills.push(product.dimensions);
      if (product.channelType) pills.push(CHANNEL_TYPE[product.channelType] ?? product.channelType);
      if (product.finish) pills.push(product.finish);
      break;
    case "fijacion":
      if (product.anchorType) pills.push(product.anchorType);
      if (product.dimDiameter) pills.push(product.dimDiameter);
      if (product.dimLength) pills.push(product.dimLength);
      break;
    case "soporteria":
      if (product.supportType) pills.push(product.supportType);
      if (product.dimDiameter) pills.push(product.dimDiameter);
      if (product.material) pills.push(product.material);
      break;
    case "herramientas_accesorios":
      if (product.accessoryType) pills.push(product.accessoryType);
      if (product.dimDiameter) pills.push(product.dimDiameter);
      if (product.compatibleTool) pills.push(product.compatibleTool);
      break;
  }
  return pills.slice(0, 4);
}
