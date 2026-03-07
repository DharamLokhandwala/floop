"use client";

import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const PRIMARY_DOT = "#3a3cff";

type AuditThumbnailCardProps = {
  id: string;
  screenshotUrl: string;
  goal: string;
  url: string;
  dateFormatted: string;
  /** For requested tab */
  reviewerName?: string | null;
  /** Total comments (requested) or new comments label (given) */
  commentsLabel: string;
  hasNewComments?: boolean;
  canEdit?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

export function AuditThumbnailCard({
  id,
  screenshotUrl,
  goal,
  url,
  dateFormatted,
  reviewerName,
  commentsLabel,
  hasNewComments = false,
  canEdit = true,
  selected = false,
  onToggleSelect,
}: AuditThumbnailCardProps) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push(`/audit/${id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/audit/${id}`);
        }
      }}
    >
      <div className="relative aspect-video w-full bg-muted overflow-hidden">
        <img
          src={screenshotUrl}
          alt=""
          className="w-full h-full object-cover object-top"
        />
        {canEdit && onToggleSelect && (
          <div
            className={cn(
              "absolute top-2 right-2 transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(id)}
              aria-label="Select card"
            />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 min-w-0">
        {reviewerName !== undefined && reviewerName !== null && reviewerName.trim() !== "" && (
          <p className="text-xs font-medium text-muted-foreground truncate">
            {reviewerName.trim()}
          </p>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
        <p className="text-sm text-foreground line-clamp-2 min-h-0">{goal}</p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{dateFormatted}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            {hasNewComments && (
              <span
                className="rounded-full size-1.5 shrink-0"
                style={{ backgroundColor: PRIMARY_DOT }}
                aria-hidden
              />
            )}
            {commentsLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
