"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Pin } from "@/types/audit";

export type PendingLiveClick = {
  x: number;
  y: number;
  pageUrl?: string;
  selector?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  scrollX?: number;
  scrollY?: number;
};

const MODAL_WIDTH = 380;
const MODAL_MAX_HEIGHT = 320;
const PIN_OFFSET_X = 24;
const PIN_OFFSET_Y = -40;

interface AddPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (pin: Pin) => void;
  /** Screenshot flow: click position on static image */
  position: { x: number; y: number } | null;
  /** Live view flow: click payload from iframe */
  pendingLiveClick?: PendingLiveClick | null;
  /** Viewport position (px) to anchor the modal next to the click (e.g. modal to the right of pin) */
  anchorPosition?: { x: number; y: number } | null;
}

export function AddPinModal({
  open,
  onOpenChange,
  onSave,
  position,
  pendingLiveClick,
  anchorPosition,
}: AddPinModalProps) {
  const [feedback, setFeedback] = useState("");

  const hasPosition = position !== null || pendingLiveClick !== null;

  const contentStyle = useMemo(() => {
    if (!anchorPosition || typeof window === "undefined") return undefined;
    const left = Math.max(
      16,
      Math.min(anchorPosition.x + PIN_OFFSET_X, window.innerWidth - MODAL_WIDTH - 16)
    );
    const top = Math.max(
      16,
      Math.min(
        anchorPosition.y + PIN_OFFSET_Y,
        window.innerHeight - MODAL_MAX_HEIGHT - 16
      )
    );
    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: "none",
      right: "auto",
      bottom: "auto",
      maxWidth: `${MODAL_WIDTH}px`,
    } as React.CSSProperties;
  }, [anchorPosition]);

  const handleSave = () => {
    if (!feedback.trim()) return;
    const base = pendingLiveClick ?? position;
    if (!base || typeof base.x !== "number" || typeof base.y !== "number") return;

    const pin: Pin = {
      x: base.x,
      y: base.y,
      category: "Feedback",
      feedback: feedback.trim(),
    };
    if (pendingLiveClick) {
      if (pendingLiveClick.pageUrl) pin.pageUrl = pendingLiveClick.pageUrl;
      if (pendingLiveClick.selector) pin.selector = pendingLiveClick.selector;
      if (typeof pendingLiveClick.viewportWidth === "number") pin.viewportWidth = pendingLiveClick.viewportWidth;
      if (typeof pendingLiveClick.viewportHeight === "number") pin.viewportHeight = pendingLiveClick.viewportHeight;
      if (typeof pendingLiveClick.scrollX === "number") pin.scrollX = pendingLiveClick.scrollX;
      if (typeof pendingLiveClick.scrollY === "number") pin.scrollY = pendingLiveClick.scrollY;
    }

    onSave(pin);
    setFeedback("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-3xl border-0 bg-white p-6 shadow-xl dark:bg-white sm:max-w-md"
        style={contentStyle}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-lg font-bold text-black dark:text-black">
            Add feedback
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <Textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add your feedback..."
            rows={3}
            className="min-h-[80px] resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-200 dark:bg-gray-50/50"
          />
          <Button
            onClick={handleSave}
            disabled={!feedback.trim() || !hasPosition}
            className="w-full rounded-full bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Add comment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
