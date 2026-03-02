"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = "created" | "shared";

const PRIMARY_DOT = "#3a3cff";

export function DashboardTabToggle({
  createdCount,
  sharedCount,
  sharedHasNewComments,
}: {
  createdCount: number;
  sharedCount: number;
  sharedHasNewComments?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "created";

  const setTab = (t: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "created") {
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
        onClick={() => setTab("created")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          tab === "created"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Created by me ({createdCount})
      </button>
      <button
        type="button"
        onClick={() => setTab("shared")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
          tab === "shared"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Shared with me ({sharedCount})
        {sharedHasNewComments && (
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
