"use client";

import { Banner, Button, Pill } from "@payloadcms/ui";
import React, { useRef, useState } from "react";

import { parseImportFile } from "../../lib/import-catalog/schema";
import { fetchExisting } from "./api";
import { ProductsStep } from "./ProductsStep";
import { useImportCatalogStore, type WizardStep } from "./store";
import { VariantsStep } from "./VariantsStep";
import "./import-catalog.css";

const STEP_LABELS: { step: WizardStep; label: string }[] = [
  { step: "upload", label: "1 · Archivo" },
  { step: "products", label: "2 · Productos" },
  { step: "variants", label: "3 · Variantes" },
  { step: "summary", label: "4 · Resumen" },
];

export function ImportWizard() {
  const hasHydrated = useImportCatalogStore((s) => s._hasHydrated);
  const step = useImportCatalogStore((s) => s.step);
  const reset = useImportCatalogStore((s) => s.reset);

  if (!hasHydrated) {
    return <p>Cargando…</p>;
  }

  return (
    <div className="import-catalog">
      <div className="import-catalog__header">
        <h1 className="import-catalog__title">Importar catálogo</h1>
        <div className="import-catalog__stepper">
          {STEP_LABELS.map(({ step: s, label }) => (
            <Pill key={s} pillStyle={s === step ? "dark" : "light"}>
              {label}
            </Pill>
          ))}
          {step !== "upload" && (
            <Button
              buttonStyle="secondary"
              size="small"
              onClick={() => {
                if (
                  window.confirm(
                    "¿Descartar la importación en curso? Se perderán las ediciones no registradas.",
                  )
                ) {
                  reset();
                }
              }}
            >
              Descartar importación
            </Button>
          )}
        </div>
      </div>

      {step === "upload" && <UploadStep />}
      {step === "products" && <ProductsStep />}
      {step === "variants" && <VariantsStep />}
      {step === "summary" && <SummaryStep />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 1 — carga del archivo
// ---------------------------------------------------------------------------

function UploadStep() {
  const loadParsed = useImportCatalogStore((s) => s.loadParsed);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setErrors([]);
    try {
      const [existing, text] = await Promise.all([fetchExisting(), file.text()]);
      const parsed = parseImportFile(text, {
        slugs: Object.keys(existing.products),
        skus: existing.skus,
      });
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      loadParsed(parsed, existing);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Error al procesar el archivo."]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="import-catalog__upload">
      <div>
        <h2>Selecciona el archivo JSON</h2>
        <p>
          Formato esperado: objeto con <code>products</code> y <code>variants</code>{" "}
          (las variantes se vinculan por <code>productSlug</code>). El archivo se
          procesa en tu navegador; nada se registra hasta que confirmes cada paso.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {busy && <p>Procesando archivo…</p>}

      {errors.length > 0 && (
        <Banner type="error">
          <strong>El archivo tiene errores que impiden continuar:</strong>
          <ul className="import-catalog__failed-list">
            {errors.slice(0, 20).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {errors.length > 20 && <li>…y {errors.length - 20} errores más.</li>}
          </ul>
        </Banner>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 4 — resumen
// ---------------------------------------------------------------------------

function SummaryStep() {
  const productResults = useImportCatalogStore((s) => s.productResults);
  const variantResults = useImportCatalogStore((s) => s.variantResults);
  const products = useImportCatalogStore((s) => s.products);
  const variants = useImportCatalogStore((s) => s.variants);
  const stockUpdates = useImportCatalogStore((s) => s.stockUpdates);
  const reset = useImportCatalogStore((s) => s.reset);

  const tally = (results: Record<string, { status: string }>) => {
    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const r of Object.values(results)) {
      if (r.status === "created") created++;
      else if (r.status === "skipped") skipped++;
      else failed++;
    }
    return { created, skipped, failed };
  };

  const p = tally(productResults);
  const v = tally(variantResults);

  const failedProducts = Object.entries(productResults)
    .filter(([, r]) => r.status === "failed")
    .map(([id, r]) => ({
      label: String(products[id]?.data.name ?? id),
      message: r.message,
    }));

  const failedVariants = Object.entries(variantResults)
    .filter(([, r]) => r.status === "failed")
    .map(([id, r]) => ({
      label: String(variants[id]?.data.sku ?? id),
      message: r.message,
    }));

  return (
    <div className="import-catalog">
      <div className="import-catalog__summary-grid">
        <SummaryStat label="Productos creados" value={p.created} />
        <SummaryStat label="Productos omitidos" value={p.skipped} />
        <SummaryStat label="Productos fallidos" value={p.failed} />
        <SummaryStat label="Variantes creadas" value={v.created} />
        <SummaryStat label="Variantes omitidas" value={v.skipped} />
        <SummaryStat label="Variantes fallidas" value={v.failed} />
        <SummaryStat label="Stocks recalculados" value={Object.keys(stockUpdates).length} />
      </div>

      {failedProducts.length > 0 && (
        <Banner type="error">
          <strong>Productos fallidos:</strong>
          <ul className="import-catalog__failed-list">
            {failedProducts.map((f, i) => (
              <li key={i}>
                {f.label}: {f.message ?? "Error desconocido."}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      {failedVariants.length > 0 && (
        <Banner type="error">
          <strong>Variantes fallidas:</strong>
          <ul className="import-catalog__failed-list">
            {failedVariants.map((f, i) => (
              <li key={i}>
                {f.label}: {f.message ?? "Error desconocido."}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="import-catalog__links">
        <Button el="link" to="/collections/products" buttonStyle="secondary">
          Ver productos
        </Button>
        <Button el="link" to="/collections/variants" buttonStyle="secondary">
          Ver variantes
        </Button>
        <Button onClick={() => reset()}>Importar otro archivo</Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="import-catalog__summary-stat">
      <span className="import-catalog__summary-number">{value}</span>
      <span className="import-catalog__label">{label}</span>
    </div>
  );
}
