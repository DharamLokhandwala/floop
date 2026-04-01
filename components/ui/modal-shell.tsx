"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { MeshGradient } from "../MeshGradient";

/**
 * Shared quote shown in the right panel of all floop modals.
 * Change it here once — updates everywhere.
 */
const MODAL_QUOTE = (
  <>
    &ldquo;The element on top of X near Y besides Z needs to be moved to the
    left&rdquo; wastes time. floop&nbsp;does&nbsp;not.
    <br />
    Just start flooping!
  </>
);

/** Purple right-hand panel shown on md+ screens. */
export function ModalRightPanel() {
  return (
    <div className="hidden md:flex w-1/2 shrink-0 flex-col justify-between p-12 overflow-hidden">
      <p className="text-white text-[1.75rem] font-serif leading-relaxed tracking-tight">
      
        {MODAL_QUOTE}
      </p>
    </div>
  );
}

interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Left-column content (white card). */
  children: React.ReactNode;
}

/**
 * Two-column branded modal shell used across all floop flows:
 * - Left: white rounded card with `children`
 * - Right: purple panel with shared quote (hidden on mobile)
 * - Bottom-right: floop wordmark
 *
 * Usage:
 *   <ModalShell open={open} onOpenChange={setOpen}>
 *     <DialogHeader>…</DialogHeader>
 *     <YourForm />
 *   </ModalShell>
 */
export function ModalShell({ open, onOpenChange, children }: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 sm:max-w-[860px] overflow-hidden gap-0 rounded-3xl border border-indigo-300 bg-[#788BE6]"
        showCloseButton={false}
      >
        <div className="relative flex min-h-[540px]">
          {/* Left — form card */}
          <div className="w-full md:w-1/2 p-6">
            <div className="bg-white rounded-2xl h-full flex flex-col p-8">
              {children}
            </div>
          </div>

          <ModalRightPanel />

          {/* floop wordmark — bottom-right */}
          <img
            src="/landing/floop-thin.svg"
            alt="floop"
            className="absolute bottom-5 right-6 h-[13px] w-auto pointer-events-none"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
