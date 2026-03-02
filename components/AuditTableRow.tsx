"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Archive, Trash2, ArchiveRestore } from "lucide-react";

const PRIMARY_DOT = "#3a3cff";

interface AuditTableRowProps {
  id: string;
  href: string;
  screenshotUrl: string;
  dateFormatted: string;
  websiteUrl: string;
  goal: string;
  /** When true, show Restore instead of Archive (for archived list). */
  archived?: boolean;
  /** When false, hide archive/delete (e.g. for shared-with-me audits). */
  canEdit?: boolean;
  /** When > 0, show "[X] new comments" with dot at the right end of the row (shared tab). */
  newCommentsCount?: number;
}

export function AuditTableRow({
  id,
  href,
  screenshotUrl,
  dateFormatted,
  websiteUrl,
  goal,
  archived = false,
  canEdit = true,
  newCommentsCount = 0,
}: AuditTableRowProps) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (archiving) return;
    setArchiving(true);
    try {
      const res = await fetch(`/audit/${id}/archive`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await fetch(`/audit/${id}/unarchive`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    if (!confirm("Delete this website feedback permanently?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/audit/${id}/delete`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
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
          <TableCell className="font-medium">{dateFormatted}</TableCell>
          <TableCell>
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {websiteUrl}
            </a>
          </TableCell>
          <TableCell className="whitespace-normal break-words min-w-0 max-w-[14rem] overflow-hidden">
            <div className="flex items-center justify-between gap-2 w-full min-w-0">
              <span className="truncate min-w-0">{goal}</span>
              {canEdit && (
              <div
                className="flex items-center shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {archived ? (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={handleRestore}
                        disabled={restoring}
                      >
                        <ArchiveRestore className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Restore</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={handleArchive}
                        disabled={archiving}
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Archive</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete</TooltipContent>
                </Tooltip>
              </div>
              )}
            </div>
          </TableCell>
          {newCommentsCount > 0 && (
            <TableCell className="text-right shrink-0 w-28">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="rounded-full size-2 shrink-0"
                  style={{ backgroundColor: PRIMARY_DOT }}
                  aria-hidden
                />
                [{newCommentsCount}] new comments
              </span>
            </TableCell>
          )}
        </TableRow>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
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
