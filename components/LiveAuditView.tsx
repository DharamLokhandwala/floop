"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { InlineCommentInput, type PendingLiveClick } from "@/components/InlineCommentInput";
import type { Pin } from "@/types/audit";

function normalizePath(pathname: string, search: string = "", hash: string = ""): string {
  const p = `${pathname}${search || ""}${hash || ""}`;
  return p === "" || p === "/" ? "/" : p.replace(/\/$/, "") || "/";
}

function getPagePathFromUrlLike(
  pageUrl: string | undefined,
  auditUrl?: string
): string {
  if (!pageUrl) return "/";

  const fromPathLike = (value: string) => {
    try {
      const u = new URL(value, "http://_");
      return normalizePath(u.pathname, u.search, u.hash);
    } catch {
      return "/";
    }
  };

  const fromUrl = (u: URL) => {
    const pathParam = u.searchParams.get("path");
    if (pathParam && /\/audit\/[^/]+\/view$/i.test(u.pathname)) {
      return fromPathLike(pathParam);
    }
    return normalizePath(u.pathname, u.search, u.hash);
  };

  try {
    return fromUrl(new URL(pageUrl));
  } catch {
    try {
      return fromUrl(new URL(pageUrl, "http://_"));
    } catch {
      if (auditUrl) {
        try {
          return fromUrl(new URL(pageUrl, auditUrl));
        } catch {
          return "/";
        }
      }
      return "/";
    }
  }
}

function pinsMatch(a: Pin, b: Pin): boolean {
  if (getPagePathFromUrlLike(a.pageUrl) !== getPagePathFromUrlLike(b.pageUrl)) {
    return false;
  }
  if (typeof a.docX === "number" && typeof b.docX === "number" && typeof a.docY === "number" && typeof b.docY === "number") {
    return Math.abs(a.docX - b.docX) < 2 && Math.abs(a.docY - b.docY) < 2;
  }
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

const CATEGORY_COLORS: Record<string, string> = {
  SEO: "#3b82f6",
  "Visual Design": "#a855f7",
  CRO: "#22c55e",
  Feedback: "var(--color-floop-blue)",
};

interface LiveAuditViewProps {
  auditId: string;
  auditUrl: string;
  /** All pins (for hotspot overlay in iframe) */
  pins: Pin[];
  userPins: Pin[];
  /** Interact vs Comment mode (controlled by parent, e.g. navbar toggle) */
  commentMode: boolean;
  onCommentModeChange: (value: boolean) => void;
  /** When parent wants to highlight a pin (e.g. from sidebar click) */
  highlightPin: Pin | null;
  /** Index of highlightPin within the current page's pins (for showing tooltip in iframe) */
  highlightPinIndexInPage?: number | null;
  /** Called after we've sent HIGHLIGHT so parent can clear selection (one-time, not sticky) */
  onHighlightDone?: () => void;
  onSavePin: (pin: Pin) => Promise<void>;
  /** Called after a pin is saved successfully (e.g. to refresh sidebar). No full page reload. */
  onPinSaved?: () => void;
  /** Current path from URL so we can stay on this page after reload */
  initialPath?: string;
  /** Pin to highlight on hover (persistent outline, no scroll, no tooltip) */
  hoverHighlightPin?: Pin | null;
  /** Called whenever the iframe navigates to a new page path */
  onPageChange?: (path: string) => void;
}

export function LiveAuditView({
  auditId,
  auditUrl,
  pins,
  userPins,
  commentMode,
  onCommentModeChange,
  highlightPin,
  highlightPinIndexInPage = null,
  onHighlightDone,
  onSavePin,
  onPinSaved,
  initialPath = "",
  hoverHighlightPin = null,
  onPageChange,
}: LiveAuditViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pendingClick, setPendingClick] = useState<PendingLiveClick | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null);
  const [iframeSrcPath, setIframeSrcPath] = useState(initialPath);
  const [currentPagePath, setCurrentPagePath] = useState(initialPath);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [viewerError, setViewerError] = useState<{ status?: number; title?: string; message?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [optimisticPins, setOptimisticPins] = useState<Pin[]>([]);
  const pendingHighlightRef = useRef<Pin | null>(null);
  const pendingHighlightIndexRef = useRef<number | null>(null);

  const indicatorRef = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);

  const currentPath = useMemo(() => {
    return normalizePath(currentPagePath || "/");
  }, [currentPagePath]);
  const pinsForCurrentPage = useMemo(() => {
    const all = [...pins, ...userPins];
    return all.filter((pin) => getPagePathFromUrlLike(pin.pageUrl, auditUrl) === currentPath);
  }, [pins, userPins, currentPath, auditUrl]);

  // Merge server pins with optimistic pins (just-saved, not yet in server response)
  const pinsForHotspots = useMemo(() => {
    const fromServer = pinsForCurrentPage;
    const optimisticOnPage = optimisticPins.filter(
      (p) => getPagePathFromUrlLike(p.pageUrl, auditUrl) === currentPath
    );
    const merged = [...fromServer];
    for (const opt of optimisticOnPage) {
      if (!merged.some((s) => pinsMatch(s, opt))) merged.push(opt);
    }
    return merged;
  }, [pinsForCurrentPage, optimisticPins, currentPath, auditUrl]);

  const postToIframe = useCallback(
    (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(data, "*");
    },
    []
  );

  // Send comment mode to iframe
  useEffect(() => {
    postToIframe({ type: "SET_COMMENT_MODE", value: commentMode });
  }, [commentMode, postToIframe]);

  // When pins for current page change (e.g. after saving), update hotspots in iframe
  useEffect(() => {
    if (!iframeLoaded) return;
    postToIframe({
      type: "UPDATE_PINS",
      pins: pinsForHotspots.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        category: p.category,
        feedback: p.feedback,
        selector: p.selector,
        viewportWidth: p.viewportWidth,
        viewportHeight: p.viewportHeight,
        scrollX: p.scrollX,
        scrollY: p.scrollY,
        docX: p.docX,
        docY: p.docY,
        replies: p.replies,
        pageUrl: p.pageUrl,
      })),
    });
  }, [iframeLoaded, pinsForHotspots, postToIframe]);

  // Clear optimistic pins once they appear in server data (after router.refresh)
  useEffect(() => {
    setOptimisticPins((prev) =>
      prev.filter((opt) => !pinsForCurrentPage.some((s) => pinsMatch(s, opt)))
    );
  }, [pinsForCurrentPage]);

  // Clear optimistic pins when navigating to a different page
  useEffect(() => {
    setOptimisticPins([]);
  }, [currentPath]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "AUDIT_VIEWER_CLICK") {
        const clickPayload = {
          x: e.data.x,
          y: e.data.y,
          pageUrl: e.data.pageUrl,
          selector: e.data.selector,
          viewportWidth: e.data.viewportWidth,
          viewportHeight: e.data.viewportHeight,
          scrollX: e.data.scrollX,
          scrollY: e.data.scrollY,
          docX: e.data.docX,
          docY: e.data.docY,
        };
        setPendingClick(clickPayload);
        if (iframeRef.current && typeof e.data.x === "number" && typeof e.data.y === "number") {
          const rect = iframeRef.current.getBoundingClientRect();
          setAnchorPosition({
            x: rect.left + (e.data.x / 100) * rect.width,
            y: rect.top + (e.data.y / 100) * rect.height,
          });
        } else {
          setAnchorPosition(null);
        }
        setModalOpen(true);
      }
      if (e.data?.type === "AUDIT_SCROLL") {
        const { scrollTop, scrollHeight, clientHeight } = e.data;
        if (indicatorRef.current && scrollHeight > 0) {
           indicatorRef.current.style.top = `${(scrollTop / scrollHeight) * 100}%`;
           indicatorRef.current.style.height = `${(clientHeight / scrollHeight) * 100}%`;
        }
        setScrollHeight(prev => prev !== scrollHeight ? scrollHeight : prev);
        setClientHeight(prev => prev !== clientHeight ? clientHeight : prev);
      }
      if (e.data?.type === "AUDIT_VIEWER_READY") {
        setViewerError(null);
        const normalized = getPagePathFromUrlLike(e.data.pageUrl, auditUrl);
        setCurrentPagePath(normalized);
        onPageChange?.(normalized);

        // If we're waiting to navigate+highlight from sidebar, do it only after
        // the destination page reports it's ready. This avoids race conditions
        // where postMessage is sent before the iframe listener is attached.
        const pendingPin = pendingHighlightRef.current;
        if (pendingPin) {
          const pendingPath = getPagePathFromUrlLike(pendingPin.pageUrl, auditUrl);
          if (pendingPath === normalized) {
            pendingHighlightRef.current = null;
            const pinIndexInPage = pendingHighlightIndexRef.current;
            pendingHighlightIndexRef.current = null;
            postToIframe({
              type: "HIGHLIGHT",
              selector: pendingPin.selector || null,
              x: pendingPin.x,
              y: pendingPin.y,
            });
            if (typeof pinIndexInPage === "number") {
              postToIframe({ type: "SHOW_TOOLTIP", pinIndex: pinIndexInPage });
            }
            onHighlightDone?.();
          }
        }
      }
      if (e.data?.type === "CTRL_KEY_STATE") {
        onCommentModeChange(e.data.held);
      }
      if (e.data?.type === "PINS_MUTATED") {
        onPinSaved?.();
      }
      if (e.data?.type === "AUDIT_VIEWER_ERROR") {
        setViewerError({
          status: typeof e.data.status === "number" ? e.data.status : undefined,
          title: typeof e.data.title === "string" ? e.data.title : "Unable to load website",
          message:
            typeof e.data.message === "string"
              ? e.data.message
              : "The website view could not be loaded. Please try again.",
        });
        setIframeLoaded(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onCommentModeChange, onPinSaved, onPageChange, auditUrl, postToIframe, onHighlightDone]);

  // When parent asks to highlight a pin: navigate iframe if needed, then send HIGHLIGHT
  useEffect(() => {
    if (!highlightPin) {
      pendingHighlightRef.current = null;
      return;
    }
    const pin = highlightPin;
    const pinPath = getPagePathFromUrlLike(pin.pageUrl, auditUrl);

    if (pinPath !== currentPath) {
      pendingHighlightRef.current = pin;
      pendingHighlightIndexRef.current = typeof highlightPinIndexInPage === "number" ? highlightPinIndexInPage : null;
      setIframeSrcPath(pinPath);
    } else {
      pendingHighlightRef.current = null;
      postToIframe({
        type: "HIGHLIGHT",
        selector: pin.selector || null,
        x: pin.x,
        y: pin.y,
      });
      if (typeof highlightPinIndexInPage === "number") {
        postToIframe({ type: "SHOW_TOOLTIP", pinIndex: highlightPinIndexInPage });
      }
      onHighlightDone?.();
    }
  }, [highlightPin, highlightPinIndexInPage, currentPath, postToIframe, onHighlightDone, auditUrl]);

  useEffect(() => {
    if (!hoverHighlightPin) {
      postToIframe({ type: "CLEAR_HIGHLIGHT" });
      return;
    }
    const pinPath = getPagePathFromUrlLike(hoverHighlightPin.pageUrl, auditUrl);
    if (pinPath !== currentPath) return;
    postToIframe({
      type: "HIGHLIGHT",
      selector: hoverHighlightPin.selector || null,
      x: hoverHighlightPin.x,
      y: hoverHighlightPin.y,
      persistent: true,
      noScroll: true,
    });
  }, [hoverHighlightPin, currentPath, postToIframe]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  const handleSavePin = useCallback(async (pin: Pin) => {
    setPendingClick(null);
    setModalOpen(false);
    setAnchorPosition(null);
    // Add optimistically so hotspot appears immediately
    setOptimisticPins((prev) => [...prev, pin]);
    await onSavePin(pin);
    onPinSaved?.();
  }, [onSavePin, onPinSaved]);

  const iframeSrc = `/audit/${auditId}/view?path=${encodeURIComponent(iframeSrcPath || "/")}&v=${reloadNonce}`;

  // Show loading state again when path changes (e.g. user clicked a link in the iframe)
  useEffect(() => {
    setIframeLoaded(false);
    setViewerError(null);
  }, [iframeSrc]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 flex flex-row rounded-lg border border-border overflow-hidden relative">
        <div className="flex-1 min-w-0 h-full relative">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading website…</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Live website"
            className="w-full h-full min-h-[280px] sm:min-h-[400px] block border-0 bg-white"
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
          {viewerError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-4">
              <div className="w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-lg">
                <div className="text-xs text-muted-foreground mb-1">
                  {viewerError.status ? `Error ${viewerError.status}` : "Load error"}
                </div>
                <h3 className="text-sm sm:text-base font-semibold">{viewerError.title || "Unable to load website"}</h3>
                <p className="text-sm text-muted-foreground mt-1">{viewerError.message}</p>
                <div className="mt-3">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-zinc-700/50 dark:hover:bg-zinc-300/50 transition-colors"
                    onClick={() => {
                      setViewerError(null);
                      setIframeLoaded(false);
                      setReloadNonce((n) => n + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pin Minimap — VS Code-style scrollbar showing where pins live on the full page */}
        <div className="w-[28px] shrink-0 bg-background border-l border-border flex flex-col items-center py-2 px-1">
          <div
            className="relative w-2.5 h-full shrink-0 rounded-full overflow-hidden"
            style={{ 
              opacity: (iframeLoaded && scrollHeight > 0) ? 1 : 0, 
              pointerEvents: (iframeLoaded && scrollHeight > 0) ? 'auto' : 'none', 
              transition: 'opacity 0.3s' 
            }}
          >
            {/* Track background */}
            <div className="absolute inset-0 bg-muted/60 rounded-full" />

            {/* Viewport window indicator */}
            {scrollHeight > 0 && (
              <div
                ref={indicatorRef}
                className="absolute left-0 right-0 rounded-full bg-foreground/15 border border-foreground/20"
                style={{
                  minHeight: '4px'
                }}
              />
            )}

            {/* Clickable overlay — clicking scrolls iframe */}
            <div
              className="absolute inset-0 cursor-pointer"
              onPointerDown={(e) => {
                 e.currentTarget.setPointerCapture(e.pointerId);
                 const rect = e.currentTarget.getBoundingClientRect();
                 const percent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                 const targetScroll = percent * scrollHeight;
                 postToIframe({ type: "SCROLL_TO", y: targetScroll - clientHeight / 2, behavior: "smooth" });
              }}
              onPointerMove={(e) => {
                 if (e.buttons === 1) {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const percent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                   const targetScroll = percent * scrollHeight;
                   postToIframe({ type: "SCROLL_TO", y: targetScroll - clientHeight / 2 });
                 }
              }}
              onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
              title="Click or drag to jump to position"
            />

            {/* Pin dots */}
            {pinsForHotspots.map((pin, i) => {
              const docY = typeof pin.docY === 'number'
                ? pin.docY
                : (pin.y / 100) * scrollHeight;

              const topPct = scrollHeight > 0
                ? (docY / scrollHeight) * 100
                : pin.y;
                
              const color = CATEGORY_COLORS[pin.category ?? ''] ?? 'var(--color-floop-blue)';
              const isSelected = pendingHighlightRef.current === pin || highlightPin === pin;
              
                return (
                <div
                  key={pin.id ?? `pin-${i}`}
                  className="absolute left-0.5 right-0.5 h-1 rounded-full pointer-events-none transition-transform duration-200"
                  style={{ 
                     top: `${topPct}%`, 
                     backgroundColor: color,
                     transform: isSelected ? 'translateY(-50%) scale(1.8)' : 'translateY(-50%)',
                     zIndex: isSelected ? 10 : 1,
                     boxShadow: isSelected ? `0 0 4px ${color}` : 'none'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <InlineCommentInput
        open={modalOpen}
        anchorPosition={anchorPosition}
        pendingClick={pendingClick}
        auditId={auditId}
        onSave={handleSavePin}
        onDismiss={() => {
          setModalOpen(false);
          setPendingClick(null);
          setAnchorPosition(null);
        }}
      />
    </div>
  );
}
