"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { InlineCommentInput } from "@/components/InlineCommentInput";
import type { Pin } from "@/types/audit";
import { Pin as PinIcon, Trash2, X, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PinReplyComposer } from "@/components/PinReplyComposer";

const CATEGORY_COLORS: Record<string, string> = {
  SEO: "bg-blue-500",
  "Visual Design": "bg-purple-500",
  CRO: "bg-green-500",
  Feedback: "bg-zinc-500",
};

/** Hex pins for Figma-style avatars (matches live iframe category colors) */
const CATEGORY_HEX: Record<string, string> = {
  SEO: "#3b82f6",
  "Visual Design": "#a855f7",
  CRO: "#22c55e",
  Feedback: "#3A3CFF",
};

function commentInitials(name: string | null | undefined) {
  const s = (name || "U").trim();
  return s ? s.charAt(0).toUpperCase() : "?";
}

function replyAvatarStyle(name: string | null | undefined): CSSProperties {
  let h = 0;
  const s = name || "u";
  for (let j = 0; j < s.length; j++) h = (h + s.charCodeAt(j) * 17) % 360;
  return { background: `hsl(${h}, 46%, 44%)` };
}

function timeAgo(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "just now";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "just now";
  const seconds = Math.round((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}

interface AuditViewerProps {
  screenshotUrl: string;
  pins: Pin[];
  userPins?: Pin[];
  auditId: string;
  onPinAdded?: (pin: Pin) => void;
  selectedPinIndex?: number | null;
  /** Audit creator may delete any pin */
  isOwner?: boolean;
  /** Signed-in users may reply */
  isAuthenticated?: boolean;
  /** After reply/delete; falls back to full reload if omitted */
  onPinsMutated?: () => void;
}

function PinThreadPanel({
  pin,
  auditId,
  isOwner,
  isAuthenticated,
  anchorRect,
  onClose,
  onMutated,
}: {
  pin: Pin;
  auditId: string;
  isOwner: boolean;
  isAuthenticated: boolean;
  anchorRect: DOMRect;
  onClose: () => void;
  onMutated: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    setIsReplying(false);
    setReplyBody("");
    setErr(null);
  }, [pin.id]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const left = Math.min(
    Math.max(16, anchorRect.left + anchorRect.width / 2),
    (typeof window !== "undefined" ? window.innerWidth : 400) - 16
  );
  const top = anchorRect.bottom + 8;

  const sendReply = async () => {
    const body = replyBody.trim();
    if (!body || !pin.id) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/audit/${auditId}/pin/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinId: pin.id, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      setReplyBody("");
      onMutated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const deletePin = async () => {
    if (!pin.id || !confirm("Delete this comment?")) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/audit/${auditId}/pin?pinId=${encodeURIComponent(pin.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      onMutated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const replies = pin.replies ?? [];
  const cat = pin.category ?? "Feedback";
  const pinBadgeBg = CATEGORY_HEX[cat] ?? CATEGORY_HEX.Feedback;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[2147483646] w-[min(320px,calc(100vw-32px))] max-h-[min(72vh,520px)] overflow-y-auto overflow-x-hidden rounded-2xl bg-white text-foreground shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] antialiased flex flex-col pt-3"
      style={{
        left,
        top,
        transform: "translateX(-50%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <span className="text-[15px] font-bold text-foreground">{cat}</span>
        <div className="flex items-center gap-0.5">
          {isOwner && pin.id && (
            <button
              type="button"
              disabled={busy}
              onClick={deletePin}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#BE123C] transition-colors hover:bg-[#BE123C]/10 disabled:opacity-50 outline-none"
              aria-label="Delete comment"
              title="Delete comment"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted outline-none shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Root comment */}
      <div className="px-4 pt-2 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-black bg-[#FACC15] uppercase shadow-sm"
            aria-hidden
          >
            {commentInitials("Dharam")}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <span>Dharam Lokhandwala</span>
            {(pin as any).createdAt && (
              <>
                <span className="text-muted-foreground/40 leading-none">·</span>
                <span className="text-[10px] text-muted-foreground/70">{timeAgo((pin as any).createdAt)}</span>
              </>
            )}
          </span>
        </div>
        <div className="bg-muted/40 border border-border/50 rounded-xl p-3 text-[13px] leading-relaxed text-foreground">
          {pin.feedback}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="flex flex-col">
          {replies.map((r, idx) => (
            <div key={r.id} className="px-4 py-2 flex flex-col gap-1.5 pt-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white shadow-sm uppercase"
                  style={replyAvatarStyle(r.authorName)}
                  aria-hidden
                >
                  {commentInitials(r.authorName)}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <span>{r.authorName || "User"}</span>
                  {r.createdAt && (
                    <>
                      <span className="text-muted-foreground/40 leading-none">·</span>
                      <span className="text-[10px] text-muted-foreground/70">{timeAgo(r.createdAt)}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="bg-muted/40 border border-border/50 rounded-xl p-3 text-[13px] leading-relaxed text-foreground">
                {r.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input / Reply Button */}
      {isAuthenticated && (
        <div className="px-4 pt-1 pb-4 mt-auto">
          {!isReplying ? (
            <button
              onClick={() => setIsReplying(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#3A3CFF] hover:opacity-80 transition-opacity mt-1"
            >
              Reply <CornerDownRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white bg-[#3A3CFF] shadow-sm uppercase"
                  aria-hidden
                >
                  {commentInitials("Dharam")}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Dharam Lokhandwala
                </span>
              </div>
              <PinReplyComposer
                auditId={auditId}
                value={replyBody}
                onChange={setReplyBody}
                onSubmit={sendReply}
                disabled={!pin.id}
                submitting={busy}
                placeholder="Write a reply…"
              />
            </div>
          )}
        </div>
      )}

      {err && <p className="px-4 pb-3 text-[11px] text-red-600">{err}</p>}
      {!pin.id && (
        <p className="px-4 pb-3 text-[11px] text-[#737373]">Refresh the page to enable replies on this pin.</p>
      )}
    </div>,
    document.body
  );
}

export function AuditViewer({
  screenshotUrl,
  pins,
  userPins = [],
  auditId,
  onPinAdded,
  selectedPinIndex = null,
  isOwner = false,
  isAuthenticated = false,
  onPinsMutated,
}: AuditViewerProps) {
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [threadPin, setThreadPin] = useState<(Pin & { isUserPin: boolean; index: number }) | null>(null);
  const [threadAnchorRect, setThreadAnchorRect] = useState<DOMRect | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pinButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  type PinWithMeta = Pin & { isUserPin: boolean; index: number };

  const allPins: PinWithMeta[] = [
    ...pins.map((pin, i) => ({ ...pin, isUserPin: false, index: i })),
    ...userPins.map((pin, i) => ({ ...pin, isUserPin: true, index: pins.length + i })),
  ];

  /** Keep thread modal data in sync after reply/delete when parent refetches pins */
  useEffect(() => {
    setThreadPin((prev) => {
      if (!prev) return prev;
      const merged: PinWithMeta[] = [
        ...pins.map((pin, i) => ({ ...pin, isUserPin: false, index: i })),
        ...userPins.map((pin, i) => ({ ...pin, isUserPin: true, index: pins.length + i })),
      ];
      if (prev.id) {
        const found = merged.find((p) => p.id === prev.id && p.isUserPin === prev.isUserPin);
        if (found) return found;
      }
      const byIndex = merged[prev.index];
      if (byIndex && (!prev.id || byIndex.id === prev.id)) return byIndex;
      return prev;
    });
  }, [pins, userPins]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setClickPosition({ x: clampedX, y: clampedY });
    setAnchorPosition({ x: e.clientX, y: e.clientY });
    setIsInputOpen(true);
    setThreadPin(null);
    setThreadAnchorRect(null);
  };

  useEffect(() => {
    if (selectedPinIndex == null || selectedPinIndex < 0 || selectedPinIndex >= allPins.length) return;
    const el = pinRefs.current[selectedPinIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [selectedPinIndex, allPins.length]);

  const handleSavePin = useCallback(async (pin: Pin) => {
    setIsInputOpen(false);
    setClickPosition(null);
    setAnchorPosition(null);
    try {
      const response = await fetch(`/audit/${auditId}/add-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pin),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to save pin (${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to save pin");
      }

      onPinAdded?.(pin);

      window.location.reload();
    } catch (error) {
      console.error("Error saving pin:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save pin. Please try again.";
      alert(errorMessage);
    }
  }, [auditId, onPinAdded]);

  const openThread = (pin: PinWithMeta) => {
    const btn = pinButtonRefs.current[pin.index];
    if (btn) {
      setThreadAnchorRect(btn.getBoundingClientRect());
      setThreadPin(pin);
    }
  };

  const handleMutated = () => {
    if (onPinsMutated) onPinsMutated();
    else window.location.reload();
  };

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click on the screenshot to add your own pin
        </p>
      </div>

      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-auto rounded-lg border border-border shadow-lg bg-muted/20"
      >
        <div className="relative inline-block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={screenshotUrl}
            alt="Website screenshot"
            className="w-full h-auto block cursor-crosshair"
            onClick={handleImageClick}
          />
          <div className="absolute inset-0 pointer-events-none">
            {allPins.map((pin) => (
              <div
                key={`${pin.isUserPin ? "user" : "ai"}-${pin.id ?? pin.index}`}
                ref={(el) => {
                  pinRefs.current[pin.index] = el;
                }}
                className="absolute pointer-events-auto"
                style={{
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <button
                  ref={(el) => {
                    pinButtonRefs.current[pin.index] = el;
                  }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openThread(pin);
                  }}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-white shadow-md hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    CATEGORY_COLORS[pin.category ?? "Feedback"],
                    pin.isUserPin && "ring-2 ring-yellow-400 ring-offset-2",
                    selectedPinIndex === pin.index && "ring-4 ring-primary ring-offset-2 animate-pulse"
                  )}
                  aria-label={`Open thread: ${pin.category ?? "Feedback"}`}
                  aria-expanded={threadPin?.index === pin.index}
                >
                  <PinIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {threadPin && threadAnchorRect && (
        <PinThreadPanel
          pin={threadPin}
          auditId={auditId}
          isOwner={isOwner}
          isAuthenticated={isAuthenticated}
          anchorRect={threadAnchorRect}
          onClose={() => {
            setThreadPin(null);
            setThreadAnchorRect(null);
          }}
          onMutated={handleMutated}
        />
      )}

      <InlineCommentInput
        open={isInputOpen}
        anchorPosition={anchorPosition}
        pendingClick={clickPosition ? { x: clickPosition.x, y: clickPosition.y } : null}
        auditId={auditId}
        onSave={handleSavePin}
        onDismiss={() => {
          setIsInputOpen(false);
          setClickPosition(null);
          setAnchorPosition(null);
        }}
      />
    </div>
  );
}
