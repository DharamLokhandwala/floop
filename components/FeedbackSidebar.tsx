"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, RotateCcw, PanelRightClose, PanelRightOpen, Pencil, Check, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Pin } from "@/types/audit";
import { cn } from "@/lib/utils";

type PinWithIndex = Pin & { index: number; isUserPin: boolean };

interface FeedbackSidebarProps {
  goal: string;
  pins: Pin[];
  userPins: Pin[];
  selectedPinIndex: number | null;
  onSelectPin: (index: number) => void;
  onHoverPin?: (index: number) => void;
  onHoverLeave?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  createdAt: Date;
  /** Current user's ID — used to determine if they can edit a pin */
  currentUserId?: string;
  /** Whether current user is the audit owner (owners can edit any pin) */
  isOwner?: boolean;
  /** Audit ID for API calls */
  auditId?: string;
}

function buildAllPins(pins: Pin[], userPins: Pin[]): PinWithIndex[] {
  return [
    ...pins.map((pin, i) => ({ ...pin, index: i, isUserPin: false })),
    ...userPins.map((pin, i) => ({ ...pin, index: pins.length + i, isUserPin: true })),
  ];
}

function getPinDisplayPath(pageUrl?: string): string {
  if (!pageUrl) return "/index";
  const looksLikeProxyPath = (pathname: string) =>
    /\/audit\/[^/]+(?:\/view)?\/?$/i.test(pathname);

  const normalize = (pathname: string, hash = "") => {
    const base = !pathname || pathname === "/" ? "/index" : pathname.replace(/\/$/, "") || "/index";
    return hash ? `${base}${hash}` : base;
  };

  // Framer SPA navigation stores asset proxy URLs (e.g. /audit/{id}/asset/about).
  // Extract the canonical path from after /asset/.
  const assetProxyPath = (pathname: string): string | null => {
    const m = pathname.match(/\/audit\/[^/]+\/asset(\/.*)/i);
    return m ? m[1] || "/" : null;
  };

  const fromUrl = (u: URL) => {
    const pathParam = u.searchParams.get("path");
    if (pathParam && looksLikeProxyPath(u.pathname || "")) {
      try {
        const parsed = new URL(pathParam, "http://_");
        return normalize(parsed.pathname, parsed.hash);
      } catch {
        return "/index";
      }
    }
    const assetPath = assetProxyPath(u.pathname || "");
    if (assetPath !== null) return normalize(assetPath);
    return normalize(u.pathname || "/", u.hash || "");
  };

  try {
    return fromUrl(new URL(pageUrl));
  } catch {
    try {
      return fromUrl(new URL(pageUrl, "http://_"));
    } catch {
      return "/index";
    }
  }
}

function EditablePinCard({
  pin,
  isSelected,
  canEdit,
  canDelete,
  auditId,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onRefresh,
}: {
  pin: PinWithIndex;
  isSelected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  auditId?: string;
  onSelect: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(pin.feedback);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleSaveEdit = useCallback(async () => {
    if (!auditId || !pin.id || !editText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/audit/${auditId}/edit-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId: pin.id, feedback: editText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update comment");
      }
      toast.success("Comment updated");
      setEditing(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }, [auditId, pin.id, editText, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!auditId || !pin.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/audit/${auditId}/pin?pinId=${encodeURIComponent(pin.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete comment");
      }
      toast.success("Comment deleted");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [auditId, pin.id, onRefresh]);

  const handleCancelEdit = () => {
    setEditText(pin.feedback);
    setEditing(false);
  };

  const pagePath = getPinDisplayPath(pin.pageUrl);


  if (editing) {
    return (
      <div
        className={cn(
          "w-full text-left p-3 rounded-lg border transition-colors",
          "border-primary bg-primary/5 ring-1 ring-primary/20"
        )}
      >
        <p className="text-xs text-muted-foreground truncate mb-1.5">{pagePath}</p>
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            }
            if (e.key === "Escape") {
              handleCancelEdit();
            }
          }}
          disabled={saving}
          className="w-full text-sm text-foreground bg-background border border-border rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 min-h-[60px]"
          rows={3}
        />
        <div className="flex items-center justify-end gap-1.5 mt-2">
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-3" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={saving || !editText.trim()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Check className="size-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={cn(
        "group/pin w-full text-left p-3 rounded-lg border transition-colors cursor-pointer relative",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-muted/30 hover:bg-zinc-700/50 dark:hover:bg-zinc-300/50"
      )}
    >
      <p className="text-xs text-muted-foreground truncate mb-1">{pagePath}</p>
      {pin.authorName && (
        <p className="text-[11px] font-medium text-foreground/70 mb-0.5">{pin.authorName}</p>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground line-clamp-2 flex-1 min-w-0">{pin.feedback}</p>
        <div className="flex items-center gap-1 shrink-0">
          {(pin.replies?.length ?? 0) > 0 && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20"
              title={`${pin.replies!.length} repl${pin.replies!.length === 1 ? "y" : "ies"}`}
            >
              {pin.replies!.length}
            </span>
          )}
          {/* Edit/Delete actions — only visible on hover for the author or owner */}
          {(canEdit || canDelete) && auditId && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/pin:opacity-100 transition-opacity">
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditText(pin.feedback);
                    setEditing(true);
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit comment"
                  aria-label="Edit comment"
                >
                  <Pencil className="size-3" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this comment?")) handleDelete();
                  }}
                  disabled={deleting}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete comment"
                  aria-label="Delete comment"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackSidebar({
  goal,
  pins,
  userPins,
  selectedPinIndex,
  onSelectPin,
  onHoverPin,
  onHoverLeave,
  collapsed,
  onToggleCollapse,
  createdAt,
  currentUserId,
  isOwner = false,
  auditId,
}: FeedbackSidebarProps) {
  const router = useRouter();
  const allPins = buildAllPins(pins, userPins);
  const createdDate = new Date(createdAt);
  const isToday =
    createdDate.toDateString() === new Date().toDateString();

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <aside
      className={cn(
        "flex flex-col border-border transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-12 shrink-0" : "w-full lg:w-[320px] lg:min-w-[320px] max-h-[45vh] lg:max-h-none"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-10 shrink-0 border-b border-border bg-background hover:bg-zinc-700/50 dark:hover:bg-zinc-300/50"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
        ) : (
          <PanelRightClose className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Activity - commented out for now
          <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Activity
              </span>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground border-l-1 border-muted-foreground/40 pl-3">
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {isToday ? "TODAY" : createdDate.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}
                </span>
                <p className="mt-0.5">You created this feedback</p>
              </div>
              {allPins.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    {isToday ? "TODAY" : "—"}
                  </span>
                  <p className="mt-0.5">
                    {allPins.length} comment{allPins.length !== 1 ? "s" : ""} added
                  </p>
                </div>
              )}
            </div>
          </section>
          */}

          {goal?.trim() && (
            <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Goal
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{goal.trim()}</p>
            </section>
          )}

          {/* Feedback */}
          <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Feedback
              </span>
              
            </div>
            <div className="space-y-2">
              {allPins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No feedback yet. Switch to Comment mode and click on the page to add a pin.</p>
              ) : (
                allPins.map((pin) => {
                  const canEdit = !!(
                    currentUserId &&
                    (pin.authorId === currentUserId || isOwner)
                  );
                  const canDelete = canEdit;
                  return (
                    <EditablePinCard
                      key={pin.id ?? pin.index}
                      pin={pin}
                      isSelected={selectedPinIndex === pin.index}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      auditId={auditId}
                      onSelect={() => onSelectPin(pin.index)}
                      onHoverEnter={() => onHoverPin?.(pin.index)}
                      onHoverLeave={() => onHoverLeave?.()}
                      onRefresh={handleRefresh}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
