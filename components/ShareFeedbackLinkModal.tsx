"use client";

import { useState, useEffect } from "react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { setReviewerName } from "@/app/audit/[id]/actions";
import { ModalShell } from "@/components/ui/modal-shell";

interface ShareFeedbackLinkModalProps {
  auditId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** When true, skip the name step and show link + copy immediately (e.g. after create flow). */
  skipNameStep?: boolean;
}

export function ShareFeedbackLinkModal({
  auditId,
  open,
  onOpenChange,
  onSuccess,
  skipNameStep = false,
}: ShareFeedbackLinkModalProps) {
  const [reviewerName, setReviewerNameState] = useState("");
  const [linkGenerated, setLinkGenerated] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/audit/${auditId}?view=shared`
      : "";

  useEffect(() => {
    if (open) {
      if (skipNameStep) {
        setLinkGenerated(true);
        navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied to clipboard")).catch(() => {});
      } else {
        setLinkGenerated(false);
      }
    }
  }, [open, skipNameStep, shareUrl]);

  const handleGenerateLink = async () => {
    if (!reviewerName.trim()) {
      toast.error("Oh, did you enter the name?");
      return;
    }
    try {
      await setReviewerName(auditId, reviewerName.trim());
      await navigator.clipboard.writeText(shareUrl);
      setLinkGenerated(true);
      toast.success("Link copied to clipboard");
      onSuccess?.();
    } catch {
      toast.error("Failed to generate link");
    }
  };

  const handleCopyAgain = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <ModalShell open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="mb-7">
        <img src="/landing/floop-thin.svg" alt="floop" className="h-[14px] w-auto mb-5" />
        <DialogTitle className="text-[1.45rem] font-regular tracking-tight text-zinc-900">
          Share your feedback link
        </DialogTitle>
        <DialogDescription className="text-[13px] text-zinc-400 mt-2 leading-relaxed">
          Share this link with reviewers — no sign-in required on their end.
        </DialogDescription>
      </DialogHeader>

      <div className="border-t border-zinc-100 mb-6" />

      <div className="flex-1 flex flex-col space-y-4">
        {!linkGenerated ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor="reviewer-name" className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Who are you sharing this with?
              </label>
              <Input
                id="reviewer-name"
                type="text"
                placeholder="e.g. Alex, Design team"
                value={reviewerName}
                onChange={(e) => setReviewerNameState(e.target.value)}
                className="w-full h-11"
                required
              />
            </div>
            <Button
              className="w-full h-11 rounded-xl text-[15px] font-medium mt-2"
              onClick={handleGenerateLink}
              disabled={!reviewerName.trim()}
            >
              Generate floop link
            </Button>
          </>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Your floop link</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="font-mono text-xs flex-1 h-11"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyAgain}
                className="shrink-0 h-11 w-11 rounded-xl"
                aria-label="Copy link"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
              Send via email, Slack, or any channel. No account needed for reviewers.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
