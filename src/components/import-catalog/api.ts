"use client";

/**
 * Cliente HTTP del importador. Las llamadas van a los endpoints custom de
 * Payload (ver src/endpoints/import-catalog.ts) con la cookie de sesión admin.
 */

import type {
  ExistingResponse,
  ProductImportItem,
  ProductImportResult,
  VariantImportItem,
  VariantImportResult,
} from "../../lib/import-catalog/schema";

/** Tamaño de lote por request: evita timeouts serverless y da progreso real. */
export const CHUNK_SIZE = 20;

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let message = `Error HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // cuerpo no JSON — conservar mensaje genérico
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchExisting(): Promise<ExistingResponse> {
  const res = await fetch("/api/import-catalog/existing", {
    credentials: "include",
  });
  return (await parseJsonOrThrow(res)) as ExistingResponse;
}

export async function postProductChunk(
  items: ProductImportItem[],
): Promise<ProductImportResult[]> {
  const res = await fetch("/api/import-catalog/products", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const body = (await parseJsonOrThrow(res)) as { results: ProductImportResult[] };
  return body.results;
}

export async function postVariantChunk(items: VariantImportItem[]): Promise<{
  results: VariantImportResult[];
  stockUpdates: Record<string, number>;
  stockWarnings: string[];
}> {
  const res = await fetch("/api/import-catalog/variants", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return (await parseJsonOrThrow(res)) as {
    results: VariantImportResult[];
    stockUpdates: Record<string, number>;
    stockWarnings: string[];
  };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
