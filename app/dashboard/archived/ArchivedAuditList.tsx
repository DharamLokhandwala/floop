"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditTableRow } from "@/components/AuditTableRow";
import { DashboardSelectionBar } from "@/components/DashboardSelectionBar";
import type { AuditListItem } from "@/lib/audits";

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

export function ArchivedAuditList({ audits }: { audits: AuditListItem[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const batchRestore = useCallback(async () => {
    await Promise.all(
      Array.from(selectedIds).map(async (id) => {
        const res = await fetch(`/audit/${id}/unarchive`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to restore");
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

  return (
    <>
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[11%] px-3 py-2.5">Name</TableHead>
              <TableHead className="w-[30%] px-3 py-2.5">Website</TableHead>
              <TableHead className="w-[26%] px-3 py-2.5">Goal</TableHead>
              <TableHead className="w-[12%] text-center px-3 py-2.5">Comments</TableHead>
              <TableHead className="w-[12%] px-3 py-2.5">Date</TableHead>
              <TableHead className="w-[9%] px-2 py-2.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {audits.map((audit: AuditListItem) => (
              <AuditTableRow
                key={audit.id}
                id={audit.id}
                href={`/audit/${audit.id}`}
                screenshotUrl={audit.screenshotUrl}
                dateFormatted={formatDate(audit.createdAt)}
                websiteUrl={audit.url}
                goal={audit.goal}
                archived
                canEdit
                selected={selectedIds.has(audit.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedIds.size > 0 && (
        <DashboardSelectionBar
          selectedCount={selectedIds.size}
          mode="archived"
          onRestore={batchRestore}
          onDelete={batchDelete}
          onClearSelection={clearSelection}
        />
      )}
    </>
  );
}
