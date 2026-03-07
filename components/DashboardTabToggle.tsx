"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = "requested" | "given";

const PRIMARY_DOT = "#3a3cff";

export function DashboardTabToggle({
  requestedCount,
  givenCount,
  requestedHasFeedback,
  givenHasNewComments,
}: {
  requestedCount: number;
  givenCount: number;
  requestedHasFeedback?: boolean;
  givenHasNewComments?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "requested";

  const setTab = (t: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "requested") {
      params.delete("tab");
    } else {
      params.set("tab", t);
    }
    const q = params.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  };

  return (
    <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 w-fit">
      <button
        type="button"
        onClick={() => setTab("requested")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
          tab === "requested"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Floops requested ({requestedCount})
        {requestedHasFeedback && (
          <span
            className="rounded-full size-2 shrink-0"
            style={{ backgroundColor: PRIMARY_DOT }}
            aria-hidden
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => setTab("given")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
          tab === "given"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Floops given ({givenCount})
        {givenHasNewComments && (
          <span
            className="rounded-full size-2 shrink-0"
            style={{ backgroundColor: PRIMARY_DOT }}
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}
