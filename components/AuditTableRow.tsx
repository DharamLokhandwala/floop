"use client";

import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const PRIMARY_DOT = "var(--color-floop-blue)";

interface AuditTableRowProps {
  id: string;
  href: string;
  screenshotUrl: string;
  dateFormatted: string;
  websiteUrl: string;
  goal: string;
  /** Name for "Flooping to" column (given tab); e.g. "—" when not available. */
  name?: string | null;
  /** When true, show Restore instead of Archive (for archived list). */
  archived?: boolean;
  /** When false, hide archive/delete (e.g. for shared-with-me audits). */
  canEdit?: boolean;
  /** When > 0, show "[X] new comments" with dot at the right end of the row (shared tab). */
  newCommentsCount?: number;
  /** When > 0, show blue dot and feedback count (requested tab – someone left feedback). */
  feedbackCount?: number;
  /** Selection state for batch actions. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function AuditTableRow({
  id,
  href,
  screenshotUrl,
  dateFormatted,
  websiteUrl,
  goal,
  name = "—",
  archived = false,
  canEdit = true,
  newCommentsCount = 0,
  feedbackCount = 0,
  selected = false,
  onToggleSelect,
}: AuditTableRowProps) {
  const router = useRouter();

  const total = feedbackCount ?? 0;
  const hasNew = (newCommentsCount ?? 0) > 0;
  const commentsLabel = hasNew ? `${total} (+${newCommentsCount})` : `${total}`;

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <TableRow
          role="button"
          tabIndex={0}
          className="group cursor-pointer hover:bg-zinc-700/50 dark:hover:bg-zinc-300/50"
          onClick={() => router.push(href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(href);
            }
          }}
        >
          <TableCell className="font-medium px-3 py-2.5 align-middle">
            {name?.trim() || "—"}
          </TableCell>
          <TableCell className="min-w-0 overflow-hidden px-3 py-2.5 align-middle">
            
              {websiteUrl}
            
          </TableCell>
          <TableCell className="min-w-0 overflow-hidden px-3 py-2.5 align-middle">
            <span className="block truncate" title={goal}>{goal}</span>
          </TableCell>
          <TableCell className="text-center px-3 py-2.5 align-middle">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {hasNew && (
                  <span
                    className="rounded-full size-2 shrink-0"
                    style={{ backgroundColor: PRIMARY_DOT }}
                    aria-hidden
                  />
                )}
                {commentsLabel}
              </span>
            </div>
          </TableCell>
          <TableCell className="font-medium px-3 py-2.5 align-middle">
            {dateFormatted}
          </TableCell>
          <TableCell
            className="shrink-0 px-1 py-1 align-right"
            onClick={handleCellClick}
          >
            {canEdit && onToggleSelect && (
              <div className={cn("flex justify-end transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(id)}
                  aria-label="Select row"
                />
              </div>
            )}
          </TableCell>
        </TableRow>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={-10}
        className="max-w-none w-auto p-0 rounded-lg overflow-hidden bg-background"
      >
        <div className="w-[320px] h-[180px] overflow-hidden rounded-lg border border-zinc-300 shadow-md">
          <img
            src={screenshotUrl}
            alt="Website hero"
            className="w-full h-full object-cover object-top"
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
