"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { InlineCommentInput, type PendingLiveClick } from "@/components/InlineCommentInput";
import type { Pin } from "@/types/audit";

// ---------------------------------------------------------------------------
// Path helpers — one canonical implementation used everywhere
// ---------------------------------------------------------------------------

function normalizePath(pathname: string, search = "", hash = ""): string {
  const p = `${pathname}${search || ""}${hash || ""}`;
  return p === "" || p === "/" ? "/" : p.replace(/\/$/, "") || "/";
}

/**
 * Extract a simple pathname (e.g. "/about") from any URL-like string.
 *
 * Handles three cases:
 *   1. Proxy URL  — https://app/audit/{id}/view?path=/about  → "/about"
 *   2. Canonical  — https://example.com/about               → "/about"
 *   3. Bare path  — /about                                  → "/about"
 *
 * The audit proxy URL is the ONLY place we unwrap `?path=`.
 */
function pagePathFromUrl(pageUrl: string | undefined, auditUrl?: string): string {
  if (!pageUrl) return "/";

  const isProxyViewUrl = (pathname: string) =>
    /\/audit\/[^/]+\/view\/?$/i.test(pathname);

  // Framer SPA navigation calls pushState with the proxy-rewritten asset URL
  // (e.g. /audit/{id}/asset/about) rather than the view URL. Extract the
  // canonical path from the segment after /asset/.
  const assetProxyPath = (pathname: string): string | null => {
    const m = pathname.match(/\/audit\/[^/]+\/asset(\/.*)/i);
    return m ? m[1] || "/" : null;
  };

  const fromParsed = (u: URL): string => {
    if (isProxyViewUrl(u.pathname)) {
      const p = u.searchParams.get("path");
      if (p) {
        try {
          const inner = new URL(p, "http://_");
          return normalizePath(inner.pathname, inner.search, inner.hash);
        } catch {
          return "/";
        }
      }
      return "/";
    }
    const assetPath = assetProxyPath(u.pathname);
    if (assetPath !== null) return normalizePath(assetPath);
    return normalizePath(u.pathname, u.search, u.hash);
  };

  try { return fromParsed(new URL(pageUrl)); } catch { /* fall through */ }
  try { return fromParsed(new URL(pageUrl, "http://_")); } catch { /* fall through */ }
  if (auditUrl) {
    try { return fromParsed(new URL(pageUrl, auditUrl)); } catch { /* fall through */ }
  }
  return "/";
}

function pinsMatch(a: Pin, b: Pin): boolean {
  if (pagePathFromUrl(a.pageUrl) !== pagePathFromUrl(b.pageUrl)) return false;
  if (
    typeof a.docX === "number" && typeof b.docX === "number" &&
    typeof a.docY === "number" && typeof b.docY === "number"
  ) {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LiveAuditViewProps {
  auditId: string;
  auditUrl: string;
  pins: Pin[];
  userPins: Pin[];
  commentMode: boolean;
  onCommentModeChange: (value: boolean) => void;
  highlightPin: Pin | null;
  highlightPinIndexInPage?: number | null;
  onHighlightDone?: () => void;
  onSavePin: (pin: Pin) => Promise<void>;
  onPinSaved?: () => void;
  initialPath?: string;
  hoverHighlightPin?: Pin | null;
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

  // iframeSrcPath drives the iframe <src>. Only changes for explicit navigation
  // (initial load, sidebar pin click). Never changed by AUDIT_VIEWER_READY so
  // that SPA navigations inside the iframe don't cause full reloads.
  const [iframeSrcPath, setIframeSrcPath] = useState(initialPath);

  // currentPagePath is set exclusively by AUDIT_VIEWER_READY messages from the
  // iframe — the authoritative source for which page is currently visible.
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

  // Normalize currentPagePath to a clean pathname like "/about"
  const currentPath = useMemo(
    () => normalizePath(currentPagePath || "/"),
    [currentPagePath]
  );

  // Pins that belong to the currently visible page
  const pinsForCurrentPage = useMemo(() => {
    const all = [...pins, ...userPins];
    return all.filter((pin) => pagePathFromUrl(pin.pageUrl, auditUrl) === currentPath);
  }, [pins, userPins, currentPath, auditUrl]);

  // Merge confirmed server pins with optimistic (just-saved) ones
  const pinsForHotspots = useMemo(() => {
    const merged = [...pinsForCurrentPage];
    for (const opt of optimisticPins) {
      if (
        pagePathFromUrl(opt.pageUrl, auditUrl) === currentPath &&
        !merged.some((s) => pinsMatch(s, opt))
      ) {
        merged.push(opt);
      }
    }
    return merged;
  }, [pinsForCurrentPage, optimisticPins, currentPath, auditUrl]);

  const postToIframe = useCallback((data: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(data, "*");
  }, []);

  // ── Comment mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    postToIframe({ type: "SET_COMMENT_MODE", value: commentMode });
  }, [commentMode, postToIframe]);

  // ── Hotspot overlay in iframe ─────────────────────────────────────────────
  useEffect(() => {
    if (!iframeLoaded) return;
    postToIframe({
      type: "UPDATE_PINS",
      pins: pinsForHotspots.map((p) => ({
        id: p.id, x: p.x, y: p.y, category: p.category, feedback: p.feedback,
        selector: p.selector, viewportWidth: p.viewportWidth, viewportHeight: p.viewportHeight,
        scrollX: p.scrollX, scrollY: p.scrollY, docX: p.docX, docY: p.docY,
        replies: p.replies, pageUrl: p.pageUrl,
      })),
    });
  }, [iframeLoaded, pinsForHotspots, postToIframe]);

  // Drop optimistic pins once they've been confirmed by the server
  useEffect(() => {
    setOptimisticPins((prev) =>
      prev.filter((opt) => !pinsForCurrentPage.some((s) => pinsMatch(s, opt)))
    );
  }, [pinsForCurrentPage]);

  // Drop optimistic pins when navigating away
  useEffect(() => { setOptimisticPins([]); }, [currentPath]);

  // ── Messages from iframe ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === "AUDIT_VIEWER_CLICK") {
        const clickPayload: PendingLiveClick = {
          x: e.data.x, y: e.data.y, pageUrl: e.data.pageUrl,
          selector: e.data.selector,
          viewportWidth: e.data.viewportWidth, viewportHeight: e.data.viewportHeight,
          scrollX: e.data.scrollX, scrollY: e.data.scrollY,
          docX: e.data.docX, docY: e.data.docY,
        };
        setPendingClick(clickPayload);
        if (iframeRef.current && typeof e.data.x === "number") {
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

      if (e.data.type === "AUDIT_SCROLL") {
        const { scrollTop, scrollHeight: sh, clientHeight: ch } = e.data;
        if (indicatorRef.current && sh > 0) {
          indicatorRef.current.style.top = `${(scrollTop / sh) * 100}%`;
          indicatorRef.current.style.height = `${(ch / sh) * 100}%`;
        }
        setScrollHeight((p) => p !== sh ? sh : p);
        setClientHeight((p) => p !== ch ? ch : p);
      }

      if (e.data.type === "AUDIT_VIEWER_READY") {
        setViewerError(null);
        // pagePathFromUrl unwraps proxy URLs and canonicalises SPA paths.
        const normalized = pagePathFromUrl(e.data.pageUrl, auditUrl);


        // Update what page we think is shown — this is the ONLY place that
        // changes currentPagePath, keeping it in sync with the iframe.
        setCurrentPagePath(normalized);
        onPageChange?.(normalized);

        // Complete any pending sidebar→pin navigation
        const pendingPin = pendingHighlightRef.current;
        if (pendingPin) {
          const pendingPath = pagePathFromUrl(pendingPin.pageUrl, auditUrl);
          if (pendingPath === normalized) {
            pendingHighlightRef.current = null;
            const pinIdxInPage = pendingHighlightIndexRef.current;
            pendingHighlightIndexRef.current = null;
            postToIframe({ type: "HIGHLIGHT", selector: pendingPin.selector || null, x: pendingPin.x, y: pendingPin.y });
            if (typeof pinIdxInPage === "number") postToIframe({ type: "SHOW_TOOLTIP", pinIndex: pinIdxInPage });
            onHighlightDone?.();
          }
        }
      }

      if (e.data.type === "CTRL_KEY_STATE") onCommentModeChange(e.data.held);
      if (e.data.type === "PINS_MUTATED") onPinSaved?.();

      if (e.data.type === "AUDIT_VIEWER_ERROR") {
        setViewerError({
          status: typeof e.data.status === "number" ? e.data.status : undefined,
          title: typeof e.data.title === "string" ? e.data.title : "Unable to load website",
          message: typeof e.data.message === "string" ? e.data.message : "The website view could not be loaded.",
        });
        setIframeLoaded(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onCommentModeChange, onPinSaved, onPageChange, auditUrl, postToIframe, onHighlightDone]);

  // ── Sidebar pin → iframe navigation + highlight ───────────────────────────
  useEffect(() => {
    if (!highlightPin) { pendingHighlightRef.current = null; return; }
    const pinPath = pagePathFromUrl(highlightPin.pageUrl, auditUrl);


    if (pinPath !== currentPath) {
      pendingHighlightRef.current = highlightPin;
      pendingHighlightIndexRef.current = typeof highlightPinIndexInPage === "number" ? highlightPinIndexInPage : null;
      setIframeSrcPath(pinPath);
    } else {
      pendingHighlightRef.current = null;
      postToIframe({ type: "HIGHLIGHT", selector: highlightPin.selector || null, x: highlightPin.x, y: highlightPin.y });
      if (typeof highlightPinIndexInPage === "number") postToIframe({ type: "SHOW_TOOLTIP", pinIndex: highlightPinIndexInPage });
      onHighlightDone?.();
    }
  }, [highlightPin, highlightPinIndexInPage, currentPath, postToIframe, onHighlightDone, auditUrl]);

  // ── Hover highlight ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!hoverHighlightPin) { postToIframe({ type: "CLEAR_HIGHLIGHT" }); return; }
    if (pagePathFromUrl(hoverHighlightPin.pageUrl, auditUrl) !== currentPath) return;
    postToIframe({ type: "HIGHLIGHT", selector: hoverHighlightPin.selector || null, x: hoverHighlightPin.x, y: hoverHighlightPin.y, persistent: true, noScroll: true });
  }, [hoverHighlightPin, currentPath, postToIframe, auditUrl]);

  const handleIframeLoad = useCallback(() => { setIframeLoaded(true); }, []);

  // ── Save pin ──────────────────────────────────────────────────────────────
  // currentPath is set by AUDIT_VIEWER_READY and is the authoritative record
  // of which page is visible. We build the pin's pageUrl from it so the
  // mapping is always exact regardless of what URL the iframe sends in the
  // click payload.
  const currentPathRef = useRef(currentPath);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  const handleSavePin = useCallback(async (pin: Pin) => {
    // pin.pageUrl is now window.location.href from the iframe (sent by the viewer click handler).
    // This reflects the real current page even when the history shim fails to fire AUDIT_VIEWER_READY
    // for SPA navigations. pagePathFromUrl parses both proxy-view URLs (?path=/about) and bare
    // proxy-origin paths (/about) correctly.
    const pathFromClick = pin.pageUrl ? pagePathFromUrl(pin.pageUrl, auditUrl) : null;
    const path = pathFromClick || currentPathRef.current || "/";
    let pageUrl: string;
    try {
      // Build an absolute URL from the audit origin + current path
      pageUrl = new URL(path, new URL(auditUrl).origin).toString();
    } catch {
      pageUrl = auditUrl;
    }


    const pinToSave: Pin = { ...pin, pageUrl };

    setPendingClick(null);
    setModalOpen(false);
    setAnchorPosition(null);
    setOptimisticPins((prev) => [...prev, pinToSave]);
    await onSavePin(pinToSave);
    onPinSaved?.();
  }, [auditUrl, onSavePin, onPinSaved]);

  // ── iframe src ────────────────────────────────────────────────────────────
  const iframeSrc = `/audit/${auditId}/view?path=${encodeURIComponent(iframeSrcPath || "/")}&v=${reloadNonce}`;

  useEffect(() => {
    setIframeLoaded(false);
    setViewerError(null);
  }, [iframeSrc]);

  // ── Render ────────────────────────────────────────────────────────────────
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
                    onClick={() => { setViewerError(null); setIframeLoaded(false); setReloadNonce((n) => n + 1); }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pin minimap */}
        <div className="w-[28px] shrink-0 bg-background border-l border-border flex flex-col items-center py-2 px-1">
          <div
            className="relative w-2.5 h-full shrink-0 rounded-full overflow-hidden"
            style={{ opacity: (iframeLoaded && scrollHeight > 0) ? 1 : 0, pointerEvents: (iframeLoaded && scrollHeight > 0) ? "auto" : "none", transition: "opacity 0.3s" }}
          >
            <div className="absolute inset-0 bg-muted/60 rounded-full" />
            {scrollHeight > 0 && (
              <div ref={indicatorRef} className="absolute left-0 right-0 rounded-full bg-foreground/15 border border-foreground/20" style={{ minHeight: "4px" }} />
            )}
            <div
              className="absolute inset-0 cursor-pointer"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                postToIframe({ type: "SCROLL_TO", y: pct * scrollHeight - clientHeight / 2, behavior: "smooth" });
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                postToIframe({ type: "SCROLL_TO", y: pct * scrollHeight - clientHeight / 2 });
              }}
              onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
              title="Click or drag to jump to position"
            />
            {pinsForHotspots.map((pin, i) => {
              const docY = typeof pin.docY === "number" ? pin.docY : (pin.y / 100) * scrollHeight;
              const topPct = scrollHeight > 0 ? (docY / scrollHeight) * 100 : pin.y;
              const color = CATEGORY_COLORS[pin.category ?? ""] ?? "var(--color-floop-blue)";
              const isSelected = pendingHighlightRef.current === pin || highlightPin === pin;
              return (
                <div
                  key={pin.id ?? `pin-${i}`}
                  className="absolute left-0.5 right-0.5 h-1 rounded-full pointer-events-none transition-transform duration-200"
                  style={{ top: `${topPct}%`, backgroundColor: color, transform: isSelected ? "translateY(-50%) scale(1.8)" : "translateY(-50%)", zIndex: isSelected ? 10 : 1, boxShadow: isSelected ? `0 0 4px ${color}` : "none" }}
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
        onDismiss={() => { setModalOpen(false); setPendingClick(null); setAnchorPosition(null); }}
      />
    </div>
  );
}
