"use client";

/**
 * DatasheetButton — Phase 14B
 *
 * Renders a download/view button for a product's PDF datasheet.
 *
 * PDF validation:
 *   - Shows the button only when mimeType is "application/pdf" OR when the
 *     URL ends with ".pdf" (covers mock-data and any Payload Media item where
 *     mimeType was not populated at depth=0).
 *   - If the file exists but is not a PDF, falls back to the "not available"
 *     state so non-PDF documents are never shown as datasheets.
 *   - If url is null, shows a disabled "Ficha técnica no disponible" message.
 *
 * Accessibility:
 *   - aria-label describes both the action and the product context.
 *   - The disabled state uses a <span> (not <button>) so screen readers
 *     understand it is not interactive.
 */

import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the given url/mimeType represent a real PDF. */
function isPdf(
  url: string | null | undefined,
  mimeType: string | null | undefined
): boolean {
  if (!url) return false;
  // If the server sent a mimeType, trust it.
  if (mimeType) return mimeType === "application/pdf";
  // Fallback: check the URL path extension (covers mock data & depth=0 results).
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DatasheetButtonProps {
  /** Absolute or root-relative URL to the datasheet file. */
  url: string | null | undefined;
  /**
   * Original filename (e.g. "siemens-5sl6110-7.pdf").
   * When provided, the browser saves the file with this name instead of
   * deriving it from the URL.
   */
  filename?: string | null;
  /**
   * MIME type as stored in Payload Media.
   * Used to validate that the file is actually a PDF before showing the button.
   */
  mimeType?: string | null;
  /** Product name — used in the aria-label for screen readers. */
  productName?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatasheetButton({
  url,
  filename,
  mimeType,
  productName,
  className,
  variant = "outline",
}: DatasheetButtonProps) {
  const hasPdf = isPdf(url, mimeType);

  // --- No datasheet or file is not a PDF ---
  if (!hasPdf) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md",
          "text-muted-foreground border border-border/50 bg-muted/30",
          "cursor-default select-none",
          className
        )}
        aria-label="Ficha técnica no disponible para este producto"
        role="status"
      >
        <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Ficha técnica no disponible</span>
      </span>
    );
  }

  // --- PDF available ---
  const ariaLabel = productName
    ? `Descargar ficha técnica de ${productName} (PDF)`
    : "Descargar ficha técnica (PDF)";

  // `download` attribute: if filename is provided use it, otherwise the browser
  // derives the name from the URL. Setting download="" still triggers a download
  // in most browsers, so we omit the attribute when no filename is given to let
  // the browser open the PDF in a new tab (better UX for inline viewers).
  const downloadAttr = filename ? filename : undefined;

  return (
    <Button
      variant={variant}
      size="sm"
      asChild
      className={cn("gap-2", className)}
    >
      <a
        href={url as string}
        target="_blank"
        rel="noopener noreferrer"
        download={downloadAttr}
        aria-label={ariaLabel}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        {filename ? (
          <span className="truncate max-w-[180px]" title={filename}>
            Descargar ficha técnica
          </span>
        ) : (
          "Descargar ficha técnica"
        )}
      </a>
    </Button>
  );
}
