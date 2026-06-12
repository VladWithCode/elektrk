"use client";

import { Banner, Button, Collapsible, Pill, toast } from "@payloadcms/ui";
import React, { useMemo, useState } from "react";

import {
  SALE_TYPE_LABELS,
  SALE_TYPES,
  validateVariantDraft,
  type VariantImportItem,
  type VariantInput,
} from "../../lib/import-catalog/schema";
import { chunk, CHUNK_SIZE, postVariantChunk } from "./api";
import { resolveGroupDbId, useImportCatalogStore } from "./store";

// ---------------------------------------------------------------------------
// Paso 3 — revisión y registro de variantes (grupos colapsables por producto)
// ---------------------------------------------------------------------------

export function VariantsStep() {
  const groupOrder = useImportCatalogStore((s) => s.groupOrder);
  const variantsByProduct = useImportCatalogStore((s) => s.variantsByProduct);
  const variants = useImportCatalogStore((s) => s.variants);
  const products = useImportCatalogStore((s) => s.products);
  const existing = useImportCatalogStore((s) => s.existing);
  const productResults = useImportCatalogStore((s) => s.productResults);
  const variantsSubmitted = useImportCatalogStore((s) => s.variantsSubmitted);
  const setAllGroupsExpanded = useImportCatalogStore((s) => s.setAllGroupsExpanded);
  const mergeVariantResults = useImportCatalogStore((s) => s.mergeVariantResults);
  const markVariantsSubmitted = useImportCatalogStore((s) => s.markVariantsSubmitted);
  const setStep = useImportCatalogStore((s) => s.setStep);

  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  // SKUs duplicados entre variantes incluidas (regla cruzada).
  const duplicateSkus = useMemo(() => {
    const seen = new Map<string, number>();
    for (const v of Object.values(variants)) {
      if (v.excluded) continue;
      const sku = String(v.data.sku ?? "");
      if (!sku) continue;
      seen.set(sku, (seen.get(sku) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([sku]) => sku));
  }, [variants]);

  // Grupos sin id de producto resoluble (producto excluido o fallido en paso 2).
  const blockedGroups = useMemo(() => {
    const blocked = new Set<string>();
    for (const groupId of groupOrder) {
      if (resolveGroupDbId(groupId, existing, productResults) === undefined) {
        blocked.add(groupId);
      }
    }
    return blocked;
  }, [groupOrder, existing, productResults]);

  const includedIds = useMemo(
    () =>
      groupOrder
        .filter((g) => !blockedGroups.has(g))
        .flatMap((g) => variantsByProduct[g] ?? [])
        .filter((vid) => !variants[vid]?.excluded),
    [groupOrder, blockedGroups, variantsByProduct, variants],
  );

  const blockedCount = groupOrder
    .filter((g) => blockedGroups.has(g))
    .reduce((n, g) => n + (variantsByProduct[g]?.length ?? 0), 0);

  const invalidCount = useMemo(
    () =>
      includedIds.filter((vid) => {
        const draft = variants[vid];
        if (!draft) return false;
        const errors = validateVariantDraft(draft.data);
        return (
          Object.keys(errors).length > 0 || duplicateSkus.has(String(draft.data.sku ?? ""))
        );
      }).length,
    [includedIds, variants, duplicateSkus],
  );

  const handleSubmit = async () => {
    const items: VariantImportItem[] = [];
    for (const groupId of groupOrder) {
      const dbId = resolveGroupDbId(groupId, existing, productResults);
      if (dbId === undefined) continue;
      for (const vid of variantsByProduct[groupId] ?? []) {
        const draft = variants[vid];
        if (!draft || draft.excluded) continue;
        items.push({ variantId: vid, productId: dbId, data: draft.data as VariantInput });
      }
    }
    if (items.length === 0) {
      toast.error("No hay variantes incluidas para registrar.");
      return;
    }

    setProgress({ sent: 0, total: items.length });
    try {
      const warnings: string[] = [];
      for (const part of chunk(items, CHUNK_SIZE)) {
        const res = await postVariantChunk(part);
        mergeVariantResults(res.results, res.stockUpdates);
        warnings.push(...res.stockWarnings);
        setProgress((prev) =>
          prev ? { ...prev, sent: prev.sent + part.length } : prev,
        );
      }
      markVariantsSubmitted();
      for (const w of warnings) toast.warning(w);
      toast.success("Lote de variantes procesado.");
      setStep("summary");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar las variantes.",
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <div className="import-catalog__toolbar">
        <Pill pillStyle="light-gray">{Object.keys(variants).length} variantes en archivo</Pill>
        <Pill pillStyle="light-gray">{includedIds.length} incluidas</Pill>
        {invalidCount > 0 && <Pill pillStyle="error">{invalidCount} con errores</Pill>}
        {blockedCount > 0 && (
          <Pill pillStyle="warning">{blockedCount} bloqueadas (producto no registrado)</Pill>
        )}
        <div className="import-catalog__toolbar import-catalog__toolbar--end">
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={() => setAllGroupsExpanded(true)}
          >
            Expandir todo
          </Button>
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={() => setAllGroupsExpanded(false)}
          >
            Colapsar todo
          </Button>
          {!variantsSubmitted ? (
            <Button
              onClick={() => void handleSubmit()}
              disabled={invalidCount > 0 || includedIds.length === 0 || progress !== null}
            >
              Registrar variantes
            </Button>
          ) : (
            <Button onClick={() => setStep("summary")}>Ver resumen</Button>
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

      <div className="import-catalog__cards">
        {groupOrder.map((groupId) => {
          const name = groupId.startsWith("db:")
            ? `Producto existente: ${groupId.slice(3)}`
            : String(products[groupId]?.data.name ?? groupId);
          return (
            <VariantGroup
              key={groupId}
              groupId={groupId}
              productName={name}
              blocked={blockedGroups.has(groupId)}
              duplicateSkus={duplicateSkus}
              readOnly={variantsSubmitted || progress !== null}
            />
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Grupo colapsable por producto
// ---------------------------------------------------------------------------

const VariantGroup = React.memo(function VariantGroup({
  groupId,
  productName,
  blocked,
  duplicateSkus,
  readOnly,
}: {
  groupId: string;
  productName: string;
  blocked: boolean;
  duplicateSkus: Set<string>;
  readOnly: boolean;
}) {
  const variantIds = useImportCatalogStore((s) => s.variantsByProduct[groupId]);
  const variants = useImportCatalogStore((s) => s.variants);
  const expanded = useImportCatalogStore((s) => !!s.expandedGroups[groupId]);
  const setGroupExpanded = useImportCatalogStore((s) => s.setGroupExpanded);

  const ids = useMemo(() => variantIds ?? [], [variantIds]);

  const { errorCount, collisionCount, includedCount } = useMemo(() => {
    let errs = 0;
    let collisions = 0;
    let incl = 0;
    for (const vid of ids) {
      const draft = variants[vid];
      if (!draft || draft.excluded) continue;
      incl++;
      const fieldErrors = validateVariantDraft(draft.data);
      if (
        Object.keys(fieldErrors).length > 0 ||
        duplicateSkus.has(String(draft.data.sku ?? ""))
      ) {
        errs++;
      }
      if (draft.existsInDb) collisions++;
    }
    return { errorCount: errs, collisionCount: collisions, includedCount: incl };
  }, [ids, variants, duplicateSkus]);

  const header = (
    <div className="import-catalog__card-header">
      <span className="import-catalog__card-title">{productName}</span>
      <Pill pillStyle="light-gray" size="small">
        {includedCount}/{ids.length} variantes
      </Pill>
      {errorCount > 0 && (
        <Pill pillStyle="error" size="small">
          {errorCount} error(es)
        </Pill>
      )}
      {collisionCount > 0 && (
        <Pill pillStyle="warning" size="small">
          {collisionCount} ya existen
        </Pill>
      )}
      {blocked && (
        <Pill pillStyle="error" size="small">
          Bloqueado — producto no registrado
        </Pill>
      )}
    </div>
  );

  return (
    <Collapsible
      header={header}
      isCollapsed={!expanded}
      onToggle={(collapsed) => setGroupExpanded(groupId, !collapsed)}
      collapsibleStyle={errorCount > 0 || blocked ? "error" : "default"}
    >
      {expanded && (
        <>
          {blocked && (
            <Banner type="error">
              El producto de este grupo no fue registrado (excluido o fallido en el
              paso anterior). Sus variantes no se enviarán.
            </Banner>
          )}
          <div className="import-catalog__table-wrap">
            <table className="import-catalog__table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th>U/Empaque</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Especificación</th>
                  <th>Presentación</th>
                  <th>Unidad</th>
                  <th>Activa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ids.map((vid) => (
                  <VariantRow
                    key={vid}
                    variantId={vid}
                    duplicateSkus={duplicateSkus}
                    readOnly={readOnly || blocked}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Collapsible>
  );
});

// ---------------------------------------------------------------------------
// Fila editable de variante
// ---------------------------------------------------------------------------

const VariantRow = React.memo(function VariantRow({
  variantId,
  duplicateSkus,
  readOnly,
}: {
  variantId: string;
  duplicateSkus: Set<string>;
  readOnly: boolean;
}) {
  const draft = useImportCatalogStore((s) => s.variants[variantId]);
  const result = useImportCatalogStore((s) => s.variantResults[variantId]);
  const updateVariantField = useImportCatalogStore((s) => s.updateVariantField);
  const toggleVariantExcluded = useImportCatalogStore((s) => s.toggleVariantExcluded);

  const errors = useMemo(() => {
    if (!draft) return {};
    const fieldErrors = validateVariantDraft(draft.data);
    if (!fieldErrors.sku && duplicateSkus.has(String(draft.data.sku ?? ""))) {
      fieldErrors.sku = "SKU duplicado dentro del lote.";
    }
    return fieldErrors;
  }, [draft, duplicateSkus]);
  if (!draft) return null;

  const disabled = readOnly || draft.excluded;

  const textCell = (field: string, narrow = false, type: "text" | "number" = "text") => (
    <td className={narrow ? "import-catalog__td--narrow" : undefined}>
      <input
        className={
          errors[field]
            ? "import-catalog__input import-catalog__input--error"
            : "import-catalog__input"
        }
        type={type}
        value={String(draft.data[field] ?? "")}
        disabled={disabled}
        onChange={(e) =>
          updateVariantField(
            variantId,
            field,
            e.target.value === "" ? undefined : e.target.value,
          )
        }
        title={errors[field]}
      />
      {errors[field] && <span className="import-catalog__error">{errors[field]}</span>}
    </td>
  );

  return (
    <tr className={draft.excluded ? "import-catalog__row--excluded" : undefined}>
      {textCell("sku")}
      <td className="import-catalog__td--narrow">
        <select
          className="import-catalog__select"
          value={String(draft.data.saleType ?? "")}
          disabled={disabled}
          onChange={(e) =>
            updateVariantField(variantId, "saleType", e.target.value || undefined)
          }
        >
          <option value="">—</option>
          {SALE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SALE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {errors.saleType && (
          <span className="import-catalog__error">{errors.saleType}</span>
        )}
      </td>
      {textCell("unitsPerPackage", true, "number")}
      {textCell("price", true, "number")}
      {textCell("stock", true, "number")}
      {textCell("variantSpec")}
      {textCell("presentation")}
      {textCell("unitLabel", true)}
      <td className="import-catalog__td--narrow">
        <input
          type="checkbox"
          checked={draft.data.isActive !== false}
          disabled={disabled}
          onChange={(e) => updateVariantField(variantId, "isActive", e.target.checked)}
        />
      </td>
      <td className="import-catalog__td--narrow">
        {result ? (
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
              ? "Creada"
              : result.status === "skipped"
                ? "Omitida"
                : "Falló"}
          </Pill>
        ) : (
          <>
            {draft.existsInDb && (
              <Pill pillStyle="warning" size="small">
                Ya existe
              </Pill>
            )}
            {!readOnly && (
              <Button
                buttonStyle="secondary"
                size="xsmall"
                onClick={() => toggleVariantExcluded(variantId)}
              >
                {draft.excluded ? "Incluir" : "Excluir"}
              </Button>
            )}
          </>
        )}
      </td>
    </tr>
  );
});
