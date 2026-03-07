"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditTableRow } from "@/components/AuditTableRow";
import { RequestedAuditRow } from "@/components/RequestedAuditRow";
import { AuditThumbnailCard } from "@/components/AuditThumbnailCard";
import { DashboardSelectionBar } from "@/components/DashboardSelectionBar";
import type { ViewMode } from "@/components/ViewToggle";
import type { RequestedAuditListItem } from "@/lib/audits";
import type { SharedAuditListItem } from "@/lib/audits";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  })
    .format(d)
    .replace(",", ",");
}

/** Relative date for table: "Just now", "5m ago", "2h ago", "Today", "Yesterday", "5 days ago", etc. */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (d >= todayStart) {
    if (diffHours < 24) return `${diffHours}h ago`;
    return "Today";
  }
  if (d >= yesterdayStart && d < todayStart) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(d);
}

type SerializedRequested = Omit<RequestedAuditListItem, "createdAt"> & {
  createdAt: string;
};
type SerializedShared = Omit<SharedAuditListItem, "createdAt"> & {
  createdAt: string;
};

export function DashboardAuditView({
  requestedList,
  givenList,
  tab,
}: {
  requestedList: SerializedRequested[];
  givenList: SerializedShared[];
  tab: "requested" | "given";
}) {
  const searchParams = useSearchParams();
  const view: ViewMode = (searchParams.get("view") as ViewMode) || "list";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, view]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const batchArchive = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/audit/${id}/archive`, { method: "POST" })
      )
    );
  }, [selectedIds]);

  const batchDelete = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/audit/${id}/delete`, { method: "POST" })
      )
    );
  }, [selectedIds]);

  if (view === "thumbnail") {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tab === "requested"
            ? requestedList.map((audit: SerializedRequested) => {
                const total = audit.feedbackCount;
                const delta = audit.newCommentsCount;
                const hasNew = delta > 0;
                const commentsLabel = hasNew ? `${total} (+${delta})` : `${total}`;
                return (
                  <AuditThumbnailCard
                    key={audit.id}
                    id={audit.id}
                    screenshotUrl={audit.screenshotUrl}
                    goal={audit.goal}
                    url={audit.url}
                    dateFormatted={formatDate(audit.createdAt)}
                    reviewerName={audit.reviewerName}
                    commentsLabel={commentsLabel}
                    hasNewComments={hasNew}
                    canEdit
                    selected={selectedIds.has(audit.id)}
                    onToggleSelect={toggleSelect}
                  />
                );
              })
            : givenList.map((audit: SerializedShared) => {
                const total = audit.feedbackCount ?? 0;
                const nc = audit.newCommentsCount ?? 0;
                const hasNew = nc > 0;
                const commentsLabel = hasNew ? `${total} (+${nc})` : `${total}`;
                return (
                  <AuditThumbnailCard
                    key={audit.id}
                    id={audit.id}
                    screenshotUrl={audit.screenshotUrl}
                    goal={audit.goal}
                    url={audit.url}
                    dateFormatted={formatDate(audit.createdAt)}
                    reviewerName={audit.reviewerName}
                    commentsLabel={commentsLabel}
                    hasNewComments={hasNew}
                    canEdit={audit.isOwner}
                    selected={selectedIds.has(audit.id)}
                    onToggleSelect={audit.isOwner ? toggleSelect : undefined}
                  />
                );
              })}
        </div>
        {selectedIds.size > 0 && (
          <DashboardSelectionBar
            selectedCount={selectedIds.size}
            onArchive={batchArchive}
            onDelete={batchDelete}
            onClearSelection={clearSelection}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[11%] px-3 py-2.5">
                {tab === "requested" ? "Floop from" : "Flooping to"}
              </TableHead>
              <TableHead className="w-[30%] px-3 py-2.5">Link</TableHead>
              <TableHead className="w-[26%] px-3 py-2.5">Goal</TableHead>
              <TableHead className="w-[12%] text-center px-3 py-2.5">Comments</TableHead>
              <TableHead className="w-[12%] px-3 py-2.5">Date</TableHead>
              <TableHead className="w-[9%] px-2 py-2.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tab === "requested"
              ? requestedList.map((audit: SerializedRequested) => (
                  <RequestedAuditRow
                    key={audit.id}
                    audit={audit as unknown as RequestedAuditListItem}
                    dateFormatted={formatRelativeDate(audit.createdAt)}
                    selected={selectedIds.has(audit.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))
              : givenList.map((audit: SerializedShared) => (
                  <AuditTableRow
                    key={audit.id}
                    id={audit.id}
                    href={`/audit/${audit.id}`}
                    screenshotUrl={audit.screenshotUrl}
                    dateFormatted={formatRelativeDate(audit.createdAt)}
                    websiteUrl={audit.url}
                    goal={audit.goal}
                    name={audit.reviewerName}
                    canEdit={audit.isOwner}
                    feedbackCount={audit.feedbackCount}
                    newCommentsCount={audit.newCommentsCount}
                    selected={selectedIds.has(audit.id)}
                    onToggleSelect={audit.isOwner ? toggleSelect : undefined}
                  />
                ))}
          </TableBody>
        </Table>
      </div>
      {selectedIds.size > 0 && (
        <DashboardSelectionBar
          selectedCount={selectedIds.size}
          onArchive={batchArchive}
          onDelete={batchDelete}
          onClearSelection={clearSelection}
        />
      )}
    </>
  );
}
