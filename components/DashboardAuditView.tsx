"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreateFloopLinkDropdown } from "@/components/CreateFloopLinkDropdown";
import { Link as LinkIcon, MessageSquare, MousePointer, Share2, Inbox } from "lucide-react";
import { HalftoneDots } from "@paper-design/shaders-react";
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

  const isEmpty = tab === "requested" ? requestedList.length === 0 : givenList.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[500px] mt-6 dark:bg-card/20 rounded-xl border border-border/50 px-8 pt-16 pb-0 transition-all relative overflow-hidden">

        {/* Halftone / Dithered Background Effect (Paper Shaders) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl opacity-60">
          <HalftoneDots
            width={1280}
            height={720}
            image="/architecture.webp"
            colorBack="#fafcff"
            colorFront="#cfd0d3"
            originalColors={false}
            type="gooey"
            grid="hex"
            inverted={false}
            size={0.15}
            radius={1.25}
            contrast={0.48}
            grainMixer={0.2}
            grainOverlay={0.2}
            grainSize={0.5}
            fit="cover"
          />
        </div>


        {/* <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3 font-display relative z-10">
          {tab === "requested" ? "Request feedback" : "Given feedbacks"}
        </h2>

        <div className="max-w-xl text-center text-muted-foreground mb-8 text-sm md:text-base relative z-10">
          {tab === "requested"
            ? "Just the start of your zillion iterations."
            : "You can view all the feedbacks you have given."}
        </div> */}

        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col md:flex-row items-stretch justify-center gap-10 pb-12">
          {tab === "requested" ? (
            <>
              {/* Card 1 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-medium text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 1</div>
                <h4 className="text-lg font-medium text-foreground mb-2">Got a site? Let's floop it</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">Paste your URL and tell us what kind of feedback you're after.</p>
                <div className="mt-auto [&_button]:w-full">
                  <CreateFloopLinkDropdown directAction="request" />
                </div>
              </div>
              {/* Card 2 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-medium text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 2</div>
                <h4 className="text-lg font-medium text-foreground mb-2">Actually flooping it</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">Send the link. No installs, no logins needed on their end.</p>
              </div>
              {/* Card 3 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-medium text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 3</div>
                <h4 className="text-lg font-medium text-foreground mb-2">Checkout the feedback</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">Feedback pinned to your site. You'll know what they're talking about instantly.</p>
              </div>
            </>
          ) : (
            <>
              {/* Card 1 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-semibold text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 1</div>
                <h4 className="text-lg font-medium text-foreground mb-2">Create a floop link</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">Create a floop link for the website you want to give feedback to.</p>
              </div>
              {/* Card 2 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-semibold text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 2</div>
                <h4 className="text-lg font-medium text-foreground mb-2">Give feedback</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">Click anywhere on the live website to pin comment at that particular location.</p>
              </div>
              {/* Card 3 */}
              <div className="flex-1 bg-white/70 dark:bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-300 dark:border-white/20 flex flex-col text-left">
                <div className="text-[11px] font-semibold text-muted-foreground/70 tracking-wider mb-3 uppercase">Step 3</div>
                <h4 className="text-lg font-medium text-foreground mb-2">floop it</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">floop the feedback by sharing the link with the person you pinned feedback for.</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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
              const isOwner = audit.isOwner !== false;
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
              : givenList.map((audit: SerializedShared) => {
                const isOwner = audit.isOwner !== false;
                return (
                  <AuditTableRow
                    key={audit.id}
                    id={audit.id}
                    href={`/audit/${audit.id}`}
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
  );
}
