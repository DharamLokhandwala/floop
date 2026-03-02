import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-7 w-40" />
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-64" />
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2 flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-[7rem,1.5fr,2fr] gap-4 items-center">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

