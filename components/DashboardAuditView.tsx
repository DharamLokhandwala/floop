"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreateFloopLinkDropdown } from "@/components/CreateFloopLinkDropdown";
import { Link as LinkIcon, MessageSquare, MousePointer, Share2, Inbox } from "lucide-react";
import {
  FlowFieldBackground,
  FLOW_FIELD_BG,
  FLOW_FIELD_DASH,
} from "@/components/FlowFieldBackground";
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
  const prevTabRef = useRef(tab);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");

  useEffect(() => {
    if (prevTabRef.current !== tab) {
      // "given" is left tab, "requested" is right tab
      // If switching from given→requested, content slides left (new enters from right)
      // If switching from requested→given, content slides right (new enters from left)
      setSlideDirection(tab === "requested" ? "left" : "right");
      prevTabRef.current = tab;
    }
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
      Array.from(selectedIds).map(async (id) => {
        const res = await fetch(`/audit/${id}/archive`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to archive");
        }
      })
    );
  }, [selectedIds]);

  const batchDelete = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map(async (id) => {
        const res = await fetch(`/audit/${id}/delete`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete");
        }
      })
    );
  }, [selectedIds]);

  const isEmpty = tab === "requested" ? requestedList.length === 0 : givenList.length === 0;

  const slideStyle = {
    animation: `slide-in-${slideDirection} 0.3s ease-out both`,
  } as React.CSSProperties;

  if (isEmpty) {
    return (
      <>
        <style>{`
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        <div key={tab} style={slideStyle}>
          <div
            className="flex flex-col items-center justify-center w-full mt-6 rounded-[2rem] pt-16 px-8 pb-0 transition-all relative overflow-hidden"
            style={{ backgroundColor: "#F9FAFB" }}
          >
            {/* Custom dashed border with increased dash length */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="none" rx="32" ry="32" stroke="#CBD2F6" strokeWidth="3" strokeDasharray="16, 12" />
            </svg>

            {tab === "requested" ? (
              <>
                <h2 className="text-[1.35rem] sm:text-2xl font-medium tracking-tight text-foreground mb-2 text-center">
                  Request feedback on your website
                </h2>
                <p className="max-w-md text-center text-muted-foreground mb-6 text-sm sm:text-base leading-relaxed">
                  Paste your URL and share it with anyone who you want to get feedback from.
                </p>
                <div className="mb-12 w-48 [&_button]:w-full">
                  <CreateFloopLinkDropdown directAction="request" />
                </div>
                <div className="relative w-full max-w-4xl flex justify-center mt-auto">
                  <img src="/emptyState-feedback-requested.svg" alt="Empty state for requesting feedback" className="w-full h-auto object-contain max-h-[400px]" />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[1.35rem] sm:text-[1.7rem] font-medium tracking-tight text-foreground mb-2 text-center">
                  Create your first floop link to give feedback
                </h2>
                <p className="max-w-md text-center text-[#737373] mb-6 text-[0.95rem] leading-relaxed">
                  Create a floop link and click anywhere on the live website to pin comment at that particular location.
                </p>
                <div className="mb-12 w-44 [&_button]:w-full [&_button]:rounded-lg">
                  <CreateFloopLinkDropdown directAction="give" />
                </div>
                <div className="relative w-full max-w-4xl flex justify-center mt-auto">
                  <img src="/emptyState-feedback-given.svg" alt="Empty state for giving feedback" className="w-full h-auto object-contain max-h-[400px]" />
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (view === "thumbnail") {
    return (
      <div key={tab} style={slideStyle}>
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
                const isOwner = audit.isOwner !== false;
                const total = audit.feedbackCount ?? 0;
                const nc = audit.newCommentsCount ?? 0;
                const hasNew = nc > 0;
                const commentsLabel = hasNew ? `${total} (+${nc})` : `${total}`;
                return (
                  <AuditThumbnailCard
                    key={audit.id}
                    id={audit.id}
                    href={`/audit/${audit.id}?floopTip=1`}
                    screenshotUrl={audit.screenshotUrl}
                    goal={audit.goal}
                    url={audit.url}
                    dateFormatted={formatDate(audit.createdAt)}
                    reviewerName={audit.reviewerName}
                    commentsLabel={commentsLabel}
                    hasNewComments={hasNew}
                    canEdit={isOwner}
                    selected={selectedIds.has(audit.id)}
                    onToggleSelect={isOwner ? toggleSelect : undefined}
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
      </div>
    );
  }

  return (
    <div key={tab} style={slideStyle}>
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
                : givenList.map((audit: SerializedShared) => {
                  const isOwner = audit.isOwner !== false;
                  return (
                    <AuditTableRow
                      key={audit.id}
                      id={audit.id}
                      href={`/audit/${audit.id}?floopTip=1`}
                      screenshotUrl={audit.screenshotUrl}
                      dateFormatted={formatRelativeDate(audit.createdAt)}
                      websiteUrl={audit.url}
                      goal={audit.goal}
                      name={audit.reviewerName}
                      canEdit={isOwner}
                      feedbackCount={audit.feedbackCount}
                      newCommentsCount={audit.newCommentsCount}
                      selected={selectedIds.has(audit.id)}
                      onToggleSelect={isOwner ? toggleSelect : undefined}
                    />
                  );
                })}
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
    </div>
  );
}
