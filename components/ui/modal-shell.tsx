"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import Image from "next/image";

interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Left-column content (white card). */
  children: React.ReactNode;
  /** Optional illustration to show on the right side. */
  illustrationSrc?: string;
}

/**
 * Two-column branded modal shell used across all floop flows:
 * - Left: white rounded card with `children`
 * - Right: purple panel with shared illustration (hidden on mobile)
 */
export function ModalShell({ open, onOpenChange, children, illustrationSrc = "/popup-give-feedback.svg" }: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 sm:max-w-5xl !max-w-5xl overflow-hidden gap-0 rounded-[2rem] border-none shadow-2xl bg-[#7B8CF6] md:min-h-[600px]"
        showCloseButton={false}
      >
        <div className="w-full h-full flex flex-col md:flex-row min-h-[600px]">
          {/* Left Side: Form Container */}
          <div className="w-full md:w-1/2 bg-background m-3 rounded-[1.5rem] p-8 md:p-12 flex flex-col shrink-0 justify-center">
            <div className="w-full max-w-sm mx-auto flex flex-col justify-center h-full">
              {children}
            </div>
          </div>

          {/* Right Side: Illustration Container */}
          <div className="hidden md:flex w-full md:w-1/2 items-center justify-center p-12 relative">
            <Image
              src={illustrationSrc}
              alt="Feedback illustration"
              width={400}
              height={400}
              className="w-full max-w-[320px] h-auto object-contain"
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
