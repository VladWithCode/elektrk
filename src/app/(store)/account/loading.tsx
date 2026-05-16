/**
 * Loading skeleton for /account (dashboard).
 * Shown while getAccountDashboard() resolves (session + repository).
 */
export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-32 bg-muted rounded mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full bg-muted/60 rounded-lg" />
          ))}
        </div>

        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
                <div className="h-6 w-12 bg-muted rounded mx-auto" />
                <div className="h-3 w-20 bg-muted/60 rounded mx-auto" />
              </div>
            ))}
          </div>

          {/* Profile card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-44 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="h-3 w-3/4 bg-muted/60 rounded" />
            <div className="h-9 w-28 bg-muted/60 rounded-md" />
          </div>

          {/* Orders */}
          <div className="space-y-3">
            <div className="flex justify-between mb-3">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted/60 rounded" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-muted/60 rounded" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted/60 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 bg-muted/60 rounded-full" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
