"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { List, LayoutGrid } from "lucide-react";

export type ViewMode = "list" | "thumbnail";

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as ViewMode) || "list";

  const setView = (v: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "list") {
      params.delete("view");
    } else {
      params.set("view", v);
    }
    const q = params.toString();
    router.push(q ? `/dashboard?${q}` : "/dashboard");
  };

  return (
    <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 w-fit">
      <button
        type="button"
        onClick={() => setView("list")}
        className={cn(
          "p-2 rounded-md text-sm transition-colors",
          view === "list"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="List view"
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setView("thumbnail")}
        className={cn(
          "p-2 rounded-md text-sm transition-colors",
          view === "thumbnail"
            ? "bg-background shadow text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Thumbnail view"
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  );
}
