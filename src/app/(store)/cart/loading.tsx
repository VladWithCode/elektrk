/**
 * Loading skeleton for /cart.
 * Shown while CartPage resolves getStoreSettings() from Payload.
 */
export default function CartLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-36 bg-muted/60 rounded-md mb-8" />

      {/* Header */}
      <div className="h-7 w-40 bg-muted rounded mb-1" />
      <div className="h-4 w-24 bg-muted/60 rounded mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Line items */}
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
            >
              {/* Product image */}
              <div className="w-20 h-20 shrink-0 rounded-lg bg-muted" />
              {/* Info */}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted/60 rounded" />
                <div className="flex items-center justify-between mt-2">
                  <div className="h-8 w-28 bg-muted/60 rounded-md" />
                  <div className="h-5 w-16 bg-muted rounded" />
                </div>
              </div>
              {/* Remove */}
              <div className="w-8 h-8 bg-muted/50 rounded-md shrink-0" />
            </div>
          ))}
        </div>

        {/* Order summary */}
        <aside className="rounded-xl border border-border bg-card p-6 space-y-4 h-fit">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-20 bg-muted/60 rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <div className="h-5 w-12 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded" />
            </div>
          </div>
          <div className="h-11 w-full bg-muted/60 rounded-md" />
        </aside>
      </div>
    </div>
  );
}
