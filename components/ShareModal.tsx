"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
  auditId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareVisibility: "public" | "private";
  onSuccess?: () => void;
  screenshotUrl: string;
}

export function ShareModal({
  auditId,
  open,
  onOpenChange,
  screenshotUrl,
}: ShareModalProps) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/audit/${auditId}?view=shared` : "";

  const handleCopyLink = async () => {
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
          <DialogTitle>Share your floop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {screenshotUrl && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted">
              <img
                src={screenshotUrl}
                alt="Website preview"
                className="w-full h-auto max-h-40 object-cover object-top"
              />
            </div>
          )}
          <div>
            <p className="text-sm font-medium mb-2">floop link</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="font-mono text-xs flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <LinkIcon className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
