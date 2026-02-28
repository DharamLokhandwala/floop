"use client";

import { useState, useMemo, useCallback } from "react";

function getPagePath(pin: Pin): string {
  return (pin.pageUrl || "").replace(/\/$/, "") || "/";
}
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, MousePointer } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveAuditView } from "@/components/LiveAuditView";
import { FeedbackSidebar } from "@/components/FeedbackSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/app/audit/[id]/ShareButton";
import type { Pin } from "@/types/audit";

interface AuditPageClientProps {
  auditId: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  userPins: Pin[];
  createdAt: Date;
}

function buildAllPins(pins: Pin[], userPins: Pin[]): (Pin & { index: number })[] {
  return [
    ...pins.map((pin, i) => ({ ...pin, index: i })),
    ...userPins.map((pin, i) => ({ ...pin, index: pins.length + i })),
  ];
}

export function AuditPageClient({
  auditId,
  url,
  goal,
  pins,
  userPins,
  createdAt,
}: AuditPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPath = searchParams.get("path") ?? "";
  const isSharedView = searchParams.get("view") === "shared";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [commentMode, setCommentMode] = useState(false);

  const allPins = useMemo(() => buildAllPins(pins, userPins), [pins, userPins]);
  const highlightPin =
    selectedPinIndex != null && allPins[selectedPinIndex]
      ? allPins[selectedPinIndex]
      : null;
  const highlightPinIndexInPage = useMemo(() => {
    if (!highlightPin) return null;
    const path = getPagePath(highlightPin);
    const onPage = allPins.filter((p) => getPagePath(p) === path);
    const idx = onPage.indexOf(highlightPin);
    return idx >= 0 ? idx : null;
  }, [highlightPin, allPins]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }, [url]);

  const handleSavePin = useCallback(
    async (pin: Pin) => {
      const res = await fetch(`/audit/${auditId}/add-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pin),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save pin");
      }
    },
    [auditId]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3">
          {isSharedView ? (
            <div className="w-10 shrink-0" aria-hidden />
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium text-primary">back</span>
            </Link>
          )}
          <div className="flex-1 min-w-0 flex justify-center">
            <button
              type="button"
              onClick={copyUrl}
              className="text-xs sm:text-sm text-muted-foreground truncate max-w-[45vw] sm:max-w-[50vw] hover:text-foreground transition-colors cursor-pointer"
              title={`Copy: ${url}`}
            >
              {url}
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isSharedView && (
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setCommentMode(false)}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                    !commentMode ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MousePointer className="h-4 w-4" />
                  Interact
                </button>
                <button
                  type="button"
                  onClick={() => setCommentMode(true)}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                    commentMode ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Comment
                </button>
              </div>
            )}
            {isSharedView && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs sm:text-sm font-medium text-foreground bg-background hover:bg-muted/50 transition-colors"
              >
                {sidebarCollapsed ? "View feedback" : "Hide feedback"}
              </button>
            )}
            <ThemeToggle />
            {!isSharedView && <ShareButton auditId={auditId} />}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-w-0 min-h-0 overflow-auto p-3 sm:p-4">
          <LiveAuditView
            auditId={auditId}
            auditUrl={url}
            pins={pins}
            userPins={userPins}
            commentMode={commentMode}
            onCommentModeChange={setCommentMode}
            highlightPin={highlightPin}
            highlightPinIndexInPage={highlightPinIndexInPage}
            onHighlightDone={() => setSelectedPinIndex(null)}
            onSavePin={handleSavePin}
            onPinSaved={() => router.refresh()}
            initialPath={initialPath}
          />
        </div>
        <div className="w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-border">
          <FeedbackSidebar
            goal={goal}
            pins={pins}
            userPins={userPins}
            selectedPinIndex={selectedPinIndex}
            onSelectPin={setSelectedPinIndex}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            createdAt={createdAt}
          />
        </div>
      </main>
    </div>
  );
}
