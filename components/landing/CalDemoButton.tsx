"use client";

import { useEffect, useRef } from "react";
import { getCalApi } from "@calcom/embed-react";

const CAL_NAMESPACE = "floop";
const CAL_LINK = "dharamlokhandwala/floop";
const BODY_BLUR_CLASS = "cal-modal-open";

function addBlur() {
  if (typeof document !== "undefined") {
    document.body.classList.add(BODY_BLUR_CLASS);
  }
}

function removeBlur() {
  if (typeof document !== "undefined") {
    document.body.classList.remove(BODY_BLUR_CLASS);
  }
}

export function CalDemoButton() {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", {
        cssVarsPerTheme: { light: { "cal-brand": "#3a3cff" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });

      cal("on", {
        action: "bookerViewed",
        callback: () => addBlur(),
      });
      cal("on", {
        action: "bookerReopened",
        callback: () => addBlur(),
      });
    })();
  }, []);

  useEffect(() => {
    function isCalModalNode(node: Node): boolean {
      if (node instanceof HTMLIFrameElement) {
        return node.src?.includes("cal.com") === true;
      }
      if (node instanceof HTMLElement) {
        if (node.querySelector?.('iframe[src*="cal.com"]')) return true;
        if (node.getAttribute?.("data-cal-embed")) return true;
      }
      return false;
    }

    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.removedNodes.length === 0) continue;
        mutation.removedNodes.forEach((node) => {
          if (isCalModalNode(node)) removeBlur();
        });
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });
    return () => {
      observerRef.current?.disconnect();
      removeBlur();
    };
  }, []);

  return (
    <button
      type="button"
      data-cal-namespace={CAL_NAMESPACE}
      data-cal-link={CAL_LINK}
      data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}'
      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
    >
      Schedule a demo
    </button>
  );
}
