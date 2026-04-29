"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

function useTextScramble(text: string, active: boolean, duration = 350) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(frameRef.current);
      setDisplay(text);
      return;
    }

    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]~/|";
    const len = text.length;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const settled = Math.floor(t * len);
      let out = "";
      for (let i = 0; i < len; i++) {
        if (text[i] === " ") out += " ";
        else if (i < settled) out += text[i];
        else out += glyphs[(Math.random() * glyphs.length) | 0];
      }
      setDisplay(out);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, text, duration]);

  return display;
}

function getPagePath(pin: Pin): string {
  return (pin.pageUrl || "").replace(/\/$/, "") || "/";
}
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LinkIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiveAuditView } from "@/components/LiveAuditView";
import { FeedbackSidebar } from "@/components/FeedbackSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareModal } from "@/components/ShareModal";
import { ShareFeedbackLinkModal } from "@/components/ShareFeedbackLinkModal";
import { LoginForm } from "@/components/LoginForm";
import { FloopTipModal } from "@/components/FloopTipModal";
import type { Pin } from "@/types/audit";

interface AuditPageClientProps {
  auditId: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  userPins: Pin[];
  createdAt: Date;
  shareVisibility: "public" | "private";
  isOwner: boolean;
  isAuthenticated?: boolean;
  sharedByName?: string | null;
  allowAnonymousComments?: boolean;
  linkCreated?: boolean;
  isRequestFeedback?: boolean;
  currentUserId?: string;
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
  screenshotUrl,
  pins,
  userPins,
  createdAt,
  shareVisibility,
  isOwner,
  isAuthenticated = true,
  sharedByName,
  allowAnonymousComments = false,
  linkCreated = false,
  isRequestFeedback = false,
  currentUserId,
}: AuditPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [linkCreatedModalOpen, setLinkCreatedModalOpen] = useState(linkCreated && isOwner && isRequestFeedback);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [floopTipDismissed, setFloopTipDismissed] = useState(false);
  const initialPath = searchParams.get("path") ?? "";
  const isSharedView = searchParams.get("view") === "shared";
  const floopTipFromDashboard = searchParams.get("floopTip") === "1";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [hoveredPinIndex, setHoveredPinIndex] = useState<number | null>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const scrambledText = useTextScramble("Comment mode active", commentMode);
  const didAutoCopy = useRef(false);

  useEffect(() => {
    if (!linkCreated || !isOwner || !isRequestFeedback || didAutoCopy.current || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/audit/${auditId}?view=shared`;
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        didAutoCopy.current = true;
        toast.success("Link copied to clipboard");
      },
      () => { }
    );
  }, [linkCreated, isOwner, isRequestFeedback, auditId]);

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    const isModifierKey = (e: KeyboardEvent) =>
      isMac ? e.key === "Meta" : e.key === "Control";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModifierKey(e)) return;
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable)
      )
        return;
      setCommentMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isModifierKey(e)) setCommentMode(false);
    };
    // Don't reset comment mode when focus moves INTO the iframe — the iframe
    // has its own Ctrl tracking and will send CTRL_KEY_STATE to sync back.
    const handleBlur = () => {
      if (document.activeElement?.tagName === "IFRAME") return;
      setCommentMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isMac]);

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

  const hoverHighlightPin =
    hoveredPinIndex != null && allPins[hoveredPinIndex]
      ? allPins[hoveredPinIndex]
      : null;

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }, [url]);

  const dismissFloopTipModal = useCallback(() => {
    setFloopTipDismissed(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("floopTip");
    const q = params.toString();
    router.replace(`/audit/${auditId}${q ? `?${q}` : ""}`, { scroll: false });
  }, [auditId, router, searchParams]);

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

  const callbackUrl = `/audit/${auditId}?view=shared`;

  const showLoginOverlay = !isAuthenticated && !allowAnonymousComments;
  const showOnboardingBlur = allowAnonymousComments && !onboardingDismissed;
  const blurMain = showLoginOverlay || showOnboardingBlur;
  const showFloopTipModal =
    isAuthenticated && floopTipFromDashboard && !floopTipDismissed;

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className={cn("flex-1 flex flex-col", blurMain && "blur-md pointer-events-none select-none")}>
        <header className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3">
            {!allowAnonymousComments || isAuthenticated ? (
              isSharedView ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="font-medium text-foreground">back</span>
                </Link>
              )
            ) : (
              <div className="shrink-0" />
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
              {(isOwner || allowAnonymousComments) && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150",
                    commentMode
                      ? "bg-primary/10 text-primary border border-primary/20 animate-comment-pulse"
                      : "text-muted-foreground"
                  )}
                >
                  {commentMode ? (
                    <>
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="font-mono tracking-wide uppercase text-[11px] sm:text-xs">
                        {scrambledText}
                      </span>
                    </>
                  ) : (
                    <span>
                      Hold{" "}
                      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1.5 font-mono text-[12px] font-medium text-muted-foreground border border-border">
                        {isMac ? "⌘" : "CTRL"}
                      </kbd>{" "}
                      to comment
                    </span>
                  )}
                </div>
              )}
              {isSharedView && isAuthenticated && !allowAnonymousComments && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((c) => !c)}
                  className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs sm:text-sm font-medium text-foreground bg-background hover:bg-zinc-700/50 dark:hover:bg-zinc-300/50 transition-colors"
                >
                  {sidebarCollapsed ? "View feedback" : "Hide feedback"}
                </button>
              )}
              <ThemeToggle />
              {!isSharedView && isOwner && (
                <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
              {allowAnonymousComments && !isAuthenticated && (
                <Button asChild variant="default" size="sm">
                  <Link href={`/signup?callbackUrl=${encodeURIComponent(`/audit/${auditId}?view=shared`)}`}>
                    Sign up for free
                  </Link>
                </Button>
              )}
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
              hoverHighlightPin={hoverHighlightPin}
            />
          </div>
          <div className="w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-border">
            <FeedbackSidebar
              goal={goal}
              pins={pins}
              userPins={userPins}
              selectedPinIndex={selectedPinIndex}
              onSelectPin={setSelectedPinIndex}
              onHoverPin={setHoveredPinIndex}
              onHoverLeave={() => setHoveredPinIndex(null)}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
              createdAt={createdAt}
              currentUserId={currentUserId}
              isOwner={isOwner}
              auditId={auditId}
            />
          </div>
        </main>
      </div>

      {showLoginOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/50 backdrop-blur-md" />
          <div className="relative w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl p-8">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-xl font-semibold tracking-tight">
                {sharedByName} has shared feedback with you
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to view all the feedbacks
              </p>
            </div>
            <LoginForm callbackUrl={callbackUrl} />
          </div>
        </div>
      )}

      <FloopTipModal
        open={showFloopTipModal}
        onDismiss={dismissFloopTipModal}
        isMac={isMac}
      />

      <FloopTipModal
        open={allowAnonymousComments && !onboardingDismissed}
        onDismiss={() => setOnboardingDismissed(true)}
        isMac={isMac}
      />

      {linkCreatedModalOpen && isOwner && isRequestFeedback && (
        <ShareFeedbackLinkModal
          auditId={auditId}
          open={linkCreatedModalOpen}
          onOpenChange={setLinkCreatedModalOpen}
          onSuccess={() => router.refresh()}
        />
      )}

      {isAuthenticated && !linkCreatedModalOpen && (
        <ShareModal
          auditId={auditId}
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          shareVisibility={shareVisibility}
          onSuccess={() => router.refresh()}
          screenshotUrl={screenshotUrl}
        />
      )}

      <div className="fixed bottom-4 right-4 z-0 pointer-events-none" aria-hidden>
        <img
          src="/floop-recessed-logo.svg"
          alt=""
          className="h-10 w-auto opacity-100"
        />
      </div>
    </div>
  );
}
