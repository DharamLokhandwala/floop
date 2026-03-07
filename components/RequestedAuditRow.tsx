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
import type { RequestedAuditListItem } from "@/lib/audits";

const PRIMARY_DOT = "#3a3cff";

interface RequestedAuditRowProps {
  audit: RequestedAuditListItem;
  dateFormatted: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function RequestedAuditRow({
  audit,
  dateFormatted,
  selected = false,
  onToggleSelect,
}: RequestedAuditRowProps) {
  const router = useRouter();

  const total = audit.feedbackCount;
  const delta = audit.newCommentsCount;
  const hasNew = delta > 0;
  const commentsLabel = hasNew ? `${total} (+${delta})` : `${total}`;

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
          onClick={() => router.push(`/audit/${audit.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/audit/${audit.id}`);
            }
          }}
        >
          <TableCell className="font-medium px-3 py-2.5 align-middle">
            {audit.reviewerName?.trim() || "—"}
          </TableCell>
          <TableCell className="min-w-0 overflow-hidden px-3 py-2.5 align-middle">
           
              {audit.url}
            
          </TableCell>
          <TableCell className="min-w-0 overflow-hidden px-3 py-2.5 align-middle">
            <span className="block truncate" title={audit.goal}>{audit.goal}</span>
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
            className="w-10 shrink-0 px-2 py-2.5 text-right align-middle"
            onClick={handleCellClick}
          >
            {onToggleSelect && (
              <div
                className={cn(
                  "flex justify-end transition-opacity",
                  selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(audit.id)}
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
            src={audit.screenshotUrl}
            alt="Website hero"
            className="w-full h-full object-cover object-top"
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
