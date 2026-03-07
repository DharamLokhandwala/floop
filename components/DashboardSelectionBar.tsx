"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, Trash2, X } from "lucide-react";

interface DashboardSelectionBarProps {
  selectedCount: number;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClearSelection: () => void;
}

export function DashboardSelectionBar({
  selectedCount,
  onArchive,
  onDelete,
  onClearSelection,
}: DashboardSelectionBarProps) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    try {
      await onArchive();
      onClearSelection();
      router.refresh();
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (
      !confirm(
        `Delete ${selectedCount} website feedback${selectedCount > 1 ? "s" : ""} permanently?`
      )
    )
      return;
    setDeleting(true);
    try {
      await onDelete();
      onClearSelection();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
      <span className="text-sm text-muted-foreground mr-2">
        {selectedCount} selected
      </span>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="mr-2 size-4" />
        {deleting ? "Deleting…" : "Delete"}
      </Button>
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
