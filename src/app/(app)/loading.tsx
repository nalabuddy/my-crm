/** Shown instantly while the next page's data loads, so navigation never looks frozen. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-line" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-card" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-line bg-card" />
    </div>
  );
}
