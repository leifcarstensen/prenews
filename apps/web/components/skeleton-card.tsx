export function SkeletonCard() {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-10" />
          </div>
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="flex gap-2 mt-2">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
        <div className="skeleton h-8 w-14" />
      </div>
    </div>
  );
}

export function SkeletonFeed({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
