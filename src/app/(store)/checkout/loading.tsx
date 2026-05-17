/**
 * Loading skeleton for /checkout.
 * Shown while CheckoutPage resolves getStoreSettings() + getSessionSafe() + addresses.
 */
export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-4 w-16 bg-muted/60 rounded" />
        <div className="h-3 w-3 bg-muted/40 rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left — form */}
        <div className="lg:col-span-3 space-y-8">
          {/* Contact section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 bg-muted/60 rounded" />
                  <div className="h-9 w-full bg-muted/50 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Shipping section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="h-5 w-36 bg-muted rounded" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-9 w-full bg-muted/50 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 bg-muted/60 rounded" />
                    <div className="h-9 w-full bg-muted/50 rounded-md" />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 max-w-[180px]">
                <div className="h-3 w-24 bg-muted/60 rounded" />
                <div className="h-9 w-full bg-muted/50 rounded-md" />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="h-12 w-full bg-muted/60 rounded-md" />
        </div>

        {/* Right — order summary */}
        <aside className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="h-5 w-36 bg-muted rounded" />
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted/60 rounded" />
                    <div className="flex justify-between mt-1">
                      <div className="h-4 w-8 bg-muted/50 rounded" />
                      <div className="h-4 w-16 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-muted/60 rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <div className="h-5 w-12 bg-muted rounded" />
                <div className="h-5 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
