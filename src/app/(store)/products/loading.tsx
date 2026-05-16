/**
 * Loading skeleton for /products (catalog page).
 * Shown by Next.js while the Server Component fetches products + filters.
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-48 bg-muted rounded-lg mb-2" />
      <div className="h-4 w-72 bg-muted/60 rounded mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Filter sidebar skeleton */}
        <aside className="space-y-4 hidden lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted/60 rounded-md" />
            </div>
          ))}
        </aside>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Image placeholder */}
              <div className="aspect-square bg-muted" />
              {/* Content */}
              <div className="p-4 space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted/70 rounded" />
                <div className="h-5 w-20 bg-muted rounded mt-3" />
                <div className="h-9 w-full bg-muted/60 rounded-md mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
