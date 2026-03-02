"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { AddPinModal, type PendingLiveClick } from "@/components/AddPinModal";
import type { Pin } from "@/types/audit";

/** Normalize pin's page to path (pathname + search) for comparison with iframe path */
function getPinPath(pin: Pin): string {
  if (!pin.pageUrl) return "/";
  try {
    const u = new URL(pin.pageUrl);
    const p = u.pathname + u.search;
    return p === "" ? "/" : p.replace(/\/$/, "") || "/";
  } catch {
    return "/";
  }
}

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
}

export function LiveAuditView({
  auditId,
  auditUrl,
  pins,
  userPins,
  commentMode,
  onCommentModeChange: _onCommentModeChange,
  highlightPin,
  highlightPinIndexInPage = null,
  onHighlightDone,
  onSavePin,
  onPinSaved,
  initialPath = "",
}: LiveAuditViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pendingClick, setPendingClick] = useState<PendingLiveClick | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | null>(null);
  const [iframeSrcPath, setIframeSrcPath] = useState(initialPath);
  const [currentPagePath, setCurrentPagePath] = useState(initialPath);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const pendingHighlightRef = useRef<Pin | null>(null);
  const pendingHighlightIndexRef = useRef<number | null>(null);

  const currentPath = useMemo(() => {
    const p = currentPagePath || "/";
    const normalized = p === "/" ? "/" : p.replace(/\/$/, "") || "/";
    return normalized;
  }, [currentPagePath]);
  const pinsForCurrentPage = useMemo(() => {
    const all = [...pins, ...userPins];
    return all.filter((pin) => getPinPath(pin) === currentPath);
  }, [pins, userPins, currentPath]);

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
      pins: pinsForCurrentPage.map((p) => ({
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
      })),
    });
  }, [iframeLoaded, pinsForCurrentPage, postToIframe]);

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
      if (e.data?.type === "AUDIT_VIEWER_READY") {
        try {
          const u = new URL(e.data.pageUrl || "", "http://_");
          const p = u.pathname + u.search;
          const normalized = !p || p === "/" ? "/" : p.replace(/\/$/, "") || "/";
          setCurrentPagePath(normalized);
        } catch {
          setCurrentPagePath("/");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // When parent asks to highlight a pin: navigate iframe if needed, then send HIGHLIGHT
  useEffect(() => {
    if (!highlightPin) {
      pendingHighlightRef.current = null;
      return;
    }
    const pin = highlightPin;
    const pinPath = pin.pageUrl ? new URL(pin.pageUrl).pathname + new URL(pin.pageUrl).search : "";

    if (pinPath && pinPath !== currentPath) {
      pendingHighlightRef.current = pin;
      pendingHighlightIndexRef.current = typeof highlightPinIndexInPage === "number" ? highlightPinIndexInPage : null;
      setIframeSrcPath(pinPath);
      setCurrentPagePath(pinPath);
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
  }, [highlightPin, highlightPinIndexInPage, auditId, currentPath, postToIframe, onHighlightDone]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    const pin = pendingHighlightRef.current;
    if (pin) {
      pendingHighlightRef.current = null;
      const pinIndexInPage = pendingHighlightIndexRef.current;
      pendingHighlightIndexRef.current = null;
      postToIframe({
        type: "HIGHLIGHT",
        selector: pin.selector || null,
        x: pin.x,
        y: pin.y,
      });
      if (typeof pinIndexInPage === "number") {
        postToIframe({ type: "SHOW_TOOLTIP", pinIndex: pinIndexInPage });
      }
      onHighlightDone?.();
    }
  }, [postToIframe, onHighlightDone]);

  const handleSavePin = async (pin: Pin) => {
    await onSavePin(pin);
    setPendingClick(null);
    setModalOpen(false);
    onPinSaved?.();
  };

  const iframeSrc = `/audit/${auditId}/view?path=${encodeURIComponent(iframeSrcPath || "/")}`;

  // Show loading state again when path changes (e.g. user clicked a link in the iframe)
  useEffect(() => {
    setIframeLoaded(false);
  }, [iframeSrc]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-muted/20 relative">
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
          className="w-full h-full min-h-[280px] sm:min-h-[400px] block"
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>

      <AddPinModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setAnchorPosition(null);
        }}
        onSave={handleSavePin}
        position={null}
        pendingLiveClick={pendingClick}
        anchorPosition={anchorPosition}
      />
    </div>
  );
}
