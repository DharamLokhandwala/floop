import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden p-3 sm:p-4">
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
        <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border p-3 sm:p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

