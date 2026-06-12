"use client";

/**
 * Estado del wizard de importación de catálogo.
 *
 * - Persistido en sessionStorage: sobrevive refresh, muere al cerrar la pestaña.
 * - Los drafts viven aquí (no en estado local) para que los grupos colapsados
 *   puedan desmontarse sin perder datos.
 * - La validación de campos se deriva con validateProductDraft/validateVariantDraft
 *   en los componentes; aquí solo viven datos y acciones.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ExistingResponse,
  ParseSuccess,
  ProductDraft,
  ProductImportResult,
  VariantDraft,
  VariantImportResult,
} from "../../lib/import-catalog/schema";

export type WizardStep = "upload" | "products" | "variants" | "summary";

type ImportCatalogState = {
  _hasHydrated: boolean;
  step: WizardStep;

  products: Record<string, ProductDraft>;
  productOrder: string[];
  variants: Record<string, VariantDraft>;
  /** productImportId → variantIds (incluye grupos sintéticos "db:<slug>"). */
  variantsByProduct: Record<string, string[]>;
  /** Orden de grupos del paso 2 (ids de producto / sintéticos). */
  groupOrder: string[];

  expandedProducts: Record<string, boolean>;
  expandedGroups: Record<string, boolean>;

  existing: ExistingResponse | null;

  productResults: Record<string, ProductImportResult>;
  variantResults: Record<string, VariantImportResult>;
  stockUpdates: Record<string, number>;
  productsSubmitted: boolean;
  variantsSubmitted: boolean;

  // Acciones
  setHasHydrated: (v: boolean) => void;
  loadParsed: (parsed: ParseSuccess, existing: ExistingResponse) => void;
  setStep: (step: WizardStep) => void;

  updateProductField: (id: string, field: string, value: unknown) => void;
  toggleProductExcluded: (id: string) => void;
  setProductExpanded: (id: string, expanded: boolean) => void;
  setAllProductsExpanded: (expanded: boolean) => void;

  updateVariantField: (id: string, field: string, value: unknown) => void;
  toggleVariantExcluded: (id: string) => void;
  setGroupExpanded: (id: string, expanded: boolean) => void;
  setAllGroupsExpanded: (expanded: boolean) => void;

  mergeProductResults: (results: ProductImportResult[]) => void;
  markProductsSubmitted: () => void;
  mergeVariantResults: (
    results: VariantImportResult[],
    stockUpdates: Record<string, number>,
  ) => void;
  markVariantsSubmitted: () => void;

  reset: () => void;
};

const initialData = {
  step: "upload" as WizardStep,
  products: {},
  productOrder: [],
  variants: {},
  variantsByProduct: {},
  groupOrder: [],
  expandedProducts: {},
  expandedGroups: {},
  existing: null,
  productResults: {},
  variantResults: {},
  stockUpdates: {},
  productsSubmitted: false,
  variantsSubmitted: false,
};

export const useImportCatalogStore = create<ImportCatalogState>()(
  persist(
    (set) => ({
      ...initialData,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      loadParsed: (parsed, existing) =>
        set(() => {
          const products: Record<string, ProductDraft> = {};
          const productOrder: string[] = [];
          for (const p of parsed.products) {
            products[p._importId] = p;
            productOrder.push(p._importId);
          }

          const variants: Record<string, VariantDraft> = {};
          const variantsByProduct: Record<string, string[]> = {};
          const groupOrder: string[] = [];
          for (const v of parsed.variants) {
            variants[v._variantId] = v;
            if (!variantsByProduct[v.productImportId]) {
              variantsByProduct[v.productImportId] = [];
              groupOrder.push(v.productImportId);
            }
            variantsByProduct[v.productImportId].push(v._variantId);
          }

          // Primer grupo expandido para evidenciar que son colapsables.
          const expandedProducts: Record<string, boolean> = {};
          if (productOrder.length > 0) expandedProducts[productOrder[0]] = true;
          const expandedGroups: Record<string, boolean> = {};
          if (groupOrder.length > 0) expandedGroups[groupOrder[0]] = true;

          return {
            ...initialData,
            step: productOrder.length > 0 ? "products" : "variants",
            products,
            productOrder,
            variants,
            variantsByProduct,
            groupOrder,
            expandedProducts,
            expandedGroups,
            existing,
          };
        }),

      setStep: (step) => set({ step }),

      updateProductField: (id, field, value) =>
        set((state) => {
          const draft = state.products[id];
          if (!draft) return state;
          const data = { ...draft.data, [field]: value };
          // Editar el slug puede crear o resolver una colisión con la BD.
          const existsInDb =
            field === "slug"
              ? typeof value === "string" && !!state.existing?.products[value]
              : draft.existsInDb;
          return {
            products: { ...state.products, [id]: { ...draft, data, existsInDb } },
          };
        }),

      toggleProductExcluded: (id) =>
        set((state) => {
          const draft = state.products[id];
          if (!draft) return state;
          return {
            products: {
              ...state.products,
              [id]: { ...draft, excluded: !draft.excluded },
            },
          };
        }),

      setProductExpanded: (id, expanded) =>
        set((state) => ({
          expandedProducts: { ...state.expandedProducts, [id]: expanded },
        })),

      setAllProductsExpanded: (expanded) =>
        set((state) => {
          const expandedProducts: Record<string, boolean> = {};
          for (const id of state.productOrder) expandedProducts[id] = expanded;
          return { expandedProducts };
        }),

      updateVariantField: (id, field, value) =>
        set((state) => {
          const draft = state.variants[id];
          if (!draft) return state;
          const data = { ...draft.data, [field]: value };
          const existsInDb =
            field === "sku"
              ? typeof value === "string" && (state.existing?.skus ?? []).includes(value)
              : draft.existsInDb;
          return {
            variants: { ...state.variants, [id]: { ...draft, data, existsInDb } },
          };
        }),

      toggleVariantExcluded: (id) =>
        set((state) => {
          const draft = state.variants[id];
          if (!draft) return state;
          return {
            variants: {
              ...state.variants,
              [id]: { ...draft, excluded: !draft.excluded },
            },
          };
        }),

      setGroupExpanded: (id, expanded) =>
        set((state) => ({
          expandedGroups: { ...state.expandedGroups, [id]: expanded },
        })),

      setAllGroupsExpanded: (expanded) =>
        set((state) => {
          const expandedGroups: Record<string, boolean> = {};
          for (const id of state.groupOrder) expandedGroups[id] = expanded;
          return { expandedGroups };
        }),

      mergeProductResults: (results) =>
        set((state) => {
          const productResults = { ...state.productResults };
          for (const r of results) productResults[r.importId] = r;
          return { productResults };
        }),

      markProductsSubmitted: () => set({ productsSubmitted: true }),

      mergeVariantResults: (results, stockUpdates) =>
        set((state) => {
          const variantResults = { ...state.variantResults };
          for (const r of results) variantResults[r.variantId] = r;
          return {
            variantResults,
            stockUpdates: { ...state.stockUpdates, ...stockUpdates },
          };
        }),

      markVariantsSubmitted: () => set({ variantsSubmitted: true }),

      reset: () => set({ ...initialData }),
    }),
    {
      name: "elektrk-import-catalog",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/**
 * Id real en BD para un grupo del paso 2:
 * - grupo sintético "db:<slug>" → id del producto existente,
 * - grupo del archivo → dbId devuelto por el paso 1 (creado u omitido).
 */
export function resolveGroupDbId(
  groupId: string,
  existing: ExistingResponse | null,
  productResults: Record<string, ProductImportResult>,
): number | string | undefined {
  if (groupId.startsWith("db:")) {
    return existing?.products[groupId.slice(3)];
  }
  const result = productResults[groupId];
  if (result && result.status !== "failed") return result.dbId;
  return undefined;
}
