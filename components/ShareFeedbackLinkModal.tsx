"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { setReviewerName } from "@/app/audit/[id]/actions";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your feedback link</DialogTitle>
          <DialogDescription>
            Share this link with reviewers. They can leave feedback without signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!linkGenerated ? (
            <>
              <div className="space-y-2">
                <label htmlFor="reviewer-name" className="text-sm font-medium">
                  Who are you sharing this with? <span className="text-destructive">*</span>
                </label>
                <Input
                  id="reviewer-name"
                  type="text"
                  placeholder="e.g. Alex, Design team"
                  value={reviewerName}
                  onChange={(e) => setReviewerNameState(e.target.value)}
                  className="w-full"
                  required
                />
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateLink}
                disabled={!reviewerName.trim()}
              >
                Generate floop link
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Your floop link</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyAgain}
                    className="shrink-0"
                    aria-label="Copy link"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send this link via email, Slack, or any channel. No account required for reviewers.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
