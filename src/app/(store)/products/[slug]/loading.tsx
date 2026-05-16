/**
 * Loading skeleton for /products/[slug] (product detail page).
 * Shown while generateMetadata + the Server Component resolve.
 */
export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex gap-2 mb-6">
        <div className="h-4 w-16 bg-muted rounded" />
        <div className="h-4 w-4 bg-muted/60 rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image */}
        <div className="aspect-square rounded-xl bg-muted" />

        {/* Info */}
        <div className="space-y-4">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-7 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted/70 rounded" />
          <div className="h-4 w-5/6 bg-muted/60 rounded" />

          {/* Price */}
          <div className="h-8 w-28 bg-muted rounded mt-4" />

          {/* Variant selector */}
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-24 bg-muted/60 rounded-md" />
            ))}
          </div>

          {/* Add to cart */}
          <div className="h-11 w-full bg-muted rounded-md mt-4" />

          {/* Specs */}
          <div className="space-y-2 pt-4 border-t border-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-3 w-16 bg-muted/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
