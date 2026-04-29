"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";

interface DashboardSelectionBarProps {
  selectedCount: number;
  onArchive?: () => Promise<void>;
  onRestore?: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClearSelection: () => void;
  /** When true, show Restore instead of Archive. */
  mode?: "default" | "archived";
}

export function DashboardSelectionBar({
  selectedCount,
  onArchive,
  onRestore,
  onDelete,
  onClearSelection,
  mode = "default",
}: DashboardSelectionBarProps) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleArchive = async () => {
    if (archiving || !onArchive) return;
    setArchiving(true);
    try {
      await onArchive();
      onClearSelection();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to archive");
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (restoring || !onRestore) return;
    setRestoring(true);
    try {
      await onRestore();
      onClearSelection();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to restore");
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
      onClearSelection();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
      <span className="text-sm text-muted-foreground mr-2">
        {selectedCount} selected
      </span>
      {mode === "archived" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRestore}
          disabled={restoring}
        >
          <ArchiveRestore className="mr-2 size-4" />
          {restoring ? "Restoring…" : "Restore"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleArchive}
          disabled={archiving}
        >
          <Archive className="mr-2 size-4" />
          {archiving ? "Archiving…" : "Archive"}
        </Button>
      )}
      {showConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-destructive">Are you sure?</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Confirm"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowConfirm(true)}
          disabled={deleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onClearSelection}
        aria-label="Clear selection"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
