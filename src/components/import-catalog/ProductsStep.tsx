"use client";

import { Banner, Button, Collapsible, Pill, toast } from "@payloadcms/ui";
import React, { useMemo, useState } from "react";

import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  specFieldsForCategory,
  validateProductDraft,
  type FieldErrors,
  type ProductImportItem,
  type ProductInput,
  type SpecFieldDef,
} from "../../lib/import-catalog/schema";
import { chunk, CHUNK_SIZE, postProductChunk } from "./api";
import { useImportCatalogStore } from "./store";

// ---------------------------------------------------------------------------
// Paso 2 — revisión y registro de productos
// ---------------------------------------------------------------------------

export function ProductsStep() {
  const productOrder = useImportCatalogStore((s) => s.productOrder);
  const products = useImportCatalogStore((s) => s.products);
  const productResults = useImportCatalogStore((s) => s.productResults);
  const productsSubmitted = useImportCatalogStore((s) => s.productsSubmitted);
  const setAllProductsExpanded = useImportCatalogStore((s) => s.setAllProductsExpanded);
  const mergeProductResults = useImportCatalogStore((s) => s.mergeProductResults);
  const markProductsSubmitted = useImportCatalogStore((s) => s.markProductsSubmitted);
  const setStep = useImportCatalogStore((s) => s.setStep);

  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  // Slugs duplicados entre productos incluidos (regla cruzada).
  const duplicateSlugs = useMemo(() => {
    const seen = new Map<string, number>();
    for (const id of productOrder) {
      const draft = products[id];
      if (!draft || draft.excluded) continue;
      const slug = String(draft.data.slug ?? "");
      if (!slug) continue;
      seen.set(slug, (seen.get(slug) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([slug]) => slug));
  }, [productOrder, products]);

  const included = productOrder.filter((id) => !products[id]?.excluded);

  const invalidCount = useMemo(
    () =>
      included.filter((id) => {
        const draft = products[id];
        if (!draft) return false;
        const errors = validateProductDraft(draft.data);
        const dup = duplicateSlugs.has(String(draft.data.slug ?? ""));
        return Object.keys(errors).length > 0 || dup;
      }).length,
    [included, products, duplicateSlugs],
  );

  const failedCount = Object.values(productResults).filter(
    (r) => r.status === "failed",
  ).length;

  const handleSubmit = async () => {
    const items: ProductImportItem[] = included.map((id) => ({
      importId: id,
      data: products[id].data as ProductInput,
    }));
    if (items.length === 0) {
      toast.error("No hay productos incluidos para registrar.");
      return;
    }

    setProgress({ sent: 0, total: items.length });
    try {
      for (const part of chunk(items, CHUNK_SIZE)) {
        const results = await postProductChunk(part);
        mergeProductResults(results);
        setProgress((prev) =>
          prev ? { ...prev, sent: prev.sent + part.length } : prev,
        );
      }
      markProductsSubmitted();
      toast.success("Lote de productos procesado.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar los productos.",
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <div className="import-catalog__toolbar">
        <Pill pillStyle="light-gray">{productOrder.length} productos en archivo</Pill>
        <Pill pillStyle="light-gray">{included.length} incluidos</Pill>
        {invalidCount > 0 && <Pill pillStyle="error">{invalidCount} con errores</Pill>}
        {productsSubmitted && failedCount > 0 && (
          <Pill pillStyle="error">{failedCount} fallidos</Pill>
        )}
        <div className="import-catalog__toolbar import-catalog__toolbar--end">
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={() => setAllProductsExpanded(true)}
          >
            Expandir todo
          </Button>
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={() => setAllProductsExpanded(false)}
          >
            Colapsar todo
          </Button>
          {!productsSubmitted && (
            <Button
              onClick={() => void handleSubmit()}
              disabled={invalidCount > 0 || included.length === 0 || progress !== null}
            >
              Registrar productos
            </Button>
          )}
          {productsSubmitted && (
            <Button onClick={() => setStep("variants")}>Continuar a variantes</Button>
          )}
        </div>
      </div>

      {progress && (
        <div className="import-catalog__progress">
          <div className="import-catalog__progress-bar">
            <div
              className="import-catalog__progress-fill"
              style={{ width: `${(progress.sent / progress.total) * 100}%` }}
            />
          </div>
          <span>
            {progress.sent}/{progress.total}
          </span>
        </div>
      )}

      {productsSubmitted && (
        <Banner type={failedCount > 0 ? "error" : "success"}>
          {failedCount > 0
            ? `El lote se procesó con ${failedCount} producto(s) fallido(s). Revisa las tarjetas marcadas; puedes continuar a variantes (las variantes de productos fallidos quedarán bloqueadas).`
            : "Productos registrados correctamente. Continúa a variantes."}
        </Banner>
      )}

      <div className="import-catalog__cards">
        {productOrder.map((id) => (
          <ProductCard
            key={id}
            id={id}
            isDuplicateSlug={duplicateSlugs.has(String(products[id]?.data.slug ?? ""))}
            readOnly={productsSubmitted || progress !== null}
          />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de producto
// ---------------------------------------------------------------------------

const CORE_TEXT_FIELDS: { name: string; label: string; wide?: boolean }[] = [
  { name: "name", label: "Nombre" },
  { name: "slug", label: "Slug (URL)" },
  { name: "brand", label: "Marca" },
  { name: "model", label: "Modelo / Referencia" },
  { name: "productLine", label: "Línea / Serie" },
  { name: "shortDescription", label: "Descripción corta" },
];

const ProductCard = React.memo(function ProductCard({
  id,
  isDuplicateSlug,
  readOnly,
}: {
  id: string;
  isDuplicateSlug: boolean;
  readOnly: boolean;
}) {
  const draft = useImportCatalogStore((s) => s.products[id]);
  const expanded = useImportCatalogStore((s) => !!s.expandedProducts[id]);
  const result = useImportCatalogStore((s) => s.productResults[id]);
  const setProductExpanded = useImportCatalogStore((s) => s.setProductExpanded);
  const updateProductField = useImportCatalogStore((s) => s.updateProductField);
  const toggleProductExcluded = useImportCatalogStore((s) => s.toggleProductExcluded);

  const errors: FieldErrors = useMemo(() => {
    if (!draft) return {};
    const fieldErrors = validateProductDraft(draft.data);
    if (isDuplicateSlug && !fieldErrors.slug) {
      fieldErrors.slug = "Slug duplicado dentro del lote.";
    }
    return fieldErrors;
  }, [draft, isDuplicateSlug]);
  if (!draft) return null;

  const errorCount = draft.excluded ? 0 : Object.keys(errors).length;

  const category = String(draft.data.category ?? "");
  const specFields = specFieldsForCategory(category);
  const disabled = readOnly || draft.excluded;

  const header = (
    <div className="import-catalog__card-header">
      <span className="import-catalog__card-title">
        {String(draft.data.name ?? "(sin nombre)")}
      </span>
      <Pill pillStyle="light-gray" size="small">
        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
      </Pill>
      {errorCount > 0 && (
        <Pill pillStyle="error" size="small">
          {errorCount} error(es)
        </Pill>
      )}
      {draft.existsInDb && !result && (
        <Pill pillStyle="warning" size="small">
          Ya existe — se omitirá
        </Pill>
      )}
      {draft.warnings.length > 0 && (
        <Pill pillStyle="warning" size="small">
          Avisos
        </Pill>
      )}
      {draft.excluded && (
        <Pill pillStyle="light-gray" size="small">
          Excluido
        </Pill>
      )}
      {result && (
        <Pill
          size="small"
          pillStyle={
            result.status === "created"
              ? "success"
              : result.status === "skipped"
                ? "light-gray"
                : "error"
          }
        >
          {result.status === "created"
            ? "Creado"
            : result.status === "skipped"
              ? "Omitido (ya existía)"
              : `Falló: ${result.message ?? "error"}`}
        </Pill>
      )}
    </div>
  );

  return (
    <div className={draft.excluded ? "import-catalog__card--excluded" : undefined}>
      <Collapsible
        header={header}
        isCollapsed={!expanded}
        onToggle={(collapsed) => setProductExpanded(id, !collapsed)}
        collapsibleStyle={errorCount > 0 ? "error" : "default"}
        actions={
          !readOnly ? (
            <Button
              buttonStyle="secondary"
              size="xsmall"
              onClick={() => toggleProductExcluded(id)}
            >
              {draft.excluded ? "Incluir" : "Excluir"}
            </Button>
          ) : undefined
        }
      >
        {expanded && (
          <>
            {draft.warnings.length > 0 && (
              <div className="import-catalog__warnings">
                {draft.warnings.map((w, i) => (
                  <Banner key={i} type="info">
                    {w}
                  </Banner>
                ))}
              </div>
            )}

            <div className="import-catalog__fields">
              {CORE_TEXT_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} error={errors[f.name]}>
                  <input
                    className={inputClass("input", errors[f.name])}
                    type="text"
                    value={String(draft.data[f.name] ?? "")}
                    disabled={disabled}
                    onChange={(e) =>
                      updateProductField(id, f.name, e.target.value || undefined)
                    }
                  />
                </Field>
              ))}

              <Field label="Categoría" error={errors.category}>
                <select
                  className={inputClass("select", errors.category)}
                  value={category}
                  disabled={disabled}
                  onChange={(e) => updateProductField(id, "category", e.target.value)}
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Etiquetas (separadas por coma)" error={errors.tags}>
                <input
                  className={inputClass("input", errors.tags)}
                  type="text"
                  value={(Array.isArray(draft.data.tags) ? draft.data.tags : [])
                    .map((t) => (typeof t === "object" && t !== null ? (t as { tag?: string }).tag ?? "" : String(t)))
                    .join(", ")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateProductField(
                      id,
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((tag) => ({ tag })),
                    )
                  }
                />
              </Field>

              <div className="import-catalog__field">
                <span className="import-catalog__label">Estado</span>
                <label className="import-catalog__checkbox">
                  <input
                    type="checkbox"
                    checked={draft.data.isActive !== false}
                    disabled={disabled}
                    onChange={(e) => updateProductField(id, "isActive", e.target.checked)}
                  />
                  Activo
                </label>
                <label className="import-catalog__checkbox">
                  <input
                    type="checkbox"
                    checked={draft.data.featured === true}
                    disabled={disabled}
                    onChange={(e) => updateProductField(id, "featured", e.target.checked)}
                  />
                  Destacado
                </label>
              </div>

              <Field label="Descripción" error={errors.description} wide>
                <textarea
                  className={inputClass("textarea", errors.description)}
                  rows={3}
                  value={String(draft.data.description ?? "")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateProductField(id, "description", e.target.value || undefined)
                  }
                />
              </Field>

              <Field label="Resumen técnico" error={errors.technicalSummary} wide>
                <textarea
                  className={inputClass("textarea", errors.technicalSummary)}
                  rows={2}
                  value={String(draft.data.technicalSummary ?? "")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateProductField(id, "technicalSummary", e.target.value || undefined)
                  }
                />
              </Field>

              {specFields.map((f) => (
                <SpecField
                  key={f.name}
                  def={f}
                  value={draft.data[f.name]}
                  error={errors[f.name]}
                  disabled={disabled}
                  onChange={(value) => updateProductField(id, f.name, value)}
                />
              ))}
            </div>
          </>
        )}
      </Collapsible>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Campos auxiliares
// ---------------------------------------------------------------------------

function inputClass(kind: "input" | "select" | "textarea", error?: string): string {
  const base = `import-catalog__${kind}`;
  return error ? `${base} ${base}--error` : base;
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        wide ? "import-catalog__field import-catalog__field--wide" : "import-catalog__field"
      }
    >
      <span className="import-catalog__label">{label}</span>
      {children}
      {error && <span className="import-catalog__error">{error}</span>}
    </div>
  );
}

function SpecField({
  def,
  value,
  error,
  disabled,
  onChange,
}: {
  def: SpecFieldDef;
  value: unknown;
  error?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (def.type === "checkbox") {
    return (
      <div className="import-catalog__field">
        <span className="import-catalog__label">{def.label}</span>
        <label className="import-catalog__checkbox">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          Sí
        </label>
        {error && <span className="import-catalog__error">{error}</span>}
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <Field label={def.label} error={error}>
        <select
          className={inputClass("select", error)}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">—</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field label={def.label} error={error}>
      <input
        className={inputClass("input", error)}
        type={def.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
    </Field>
  );
}
