/**
 * Loading skeleton for /account/orders (order list).
 */
export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Back link + header */}
      <div className="h-4 w-24 bg-muted/60 rounded mb-4" />
      <div className="h-7 w-36 bg-muted rounded mb-1" />
      <div className="h-3 w-24 bg-muted/60 rounded mb-8" />

      {/* Order rows */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-5 rounded-xl border border-border bg-card gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="h-5 w-5 bg-muted/60 rounded" />
              <div className="space-y-1.5">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-3 w-36 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-20 bg-muted/60 rounded-full" />
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
