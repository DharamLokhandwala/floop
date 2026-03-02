"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon, Globe, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { setAuditShareVisibility, shareAuditWithUserEmail } from "@/app/audit/[id]/actions";

interface ShareModalProps {
  auditId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareVisibility: "public" | "private";
  onSuccess?: () => void;
}

export function ShareModal({
  auditId,
  open,
  onOpenChange,
  shareVisibility,
  onSuccess,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/audit/${auditId}?view=shared` : "";

  const handleSetPublic = async () => {
    setLoading(true);
    const res = await setAuditShareVisibility(auditId, "public");
    setLoading(false);
    if (res.success) {
      toast.success("Anyone with the link can now view");
      onSuccess?.();
    } else {
      toast.error(res.error);
    }
  };

  const handleSetPrivate = async () => {
    setLoading(true);
    const res = await setAuditShareVisibility(auditId, "private");
    setLoading(false);
    if (res.success) {
      toast.success("Only people you share with can view");
      onSuccess?.();
    } else {
      toast.error(res.error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleShareWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const res = await shareAuditWithUserEmail(auditId, email.trim());
    setLoading(false);
    if (res.success) {
      toast.success(`Shared with ${email}`);
      setEmail("");
      onSuccess?.();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div>
            <p className="text-sm font-medium mb-2">Who can view?</p>
            <div className="flex gap-2">
              <Button
                variant={shareVisibility === "public" ? "default" : "outline"}
                size="sm"
                onClick={handleSetPublic}
                disabled={loading}
                className="flex-1"
              >
                <Globe className="w-4 h-4 mr-2" />
                Public
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1 block">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full cursor-not-allowed opacity-70"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Only with email
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Coming soon</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {shareVisibility === "public"
                ? "Anyone with the link can view this feedback."
                : "Only people you share with by email can view."}
            </p>
          </div>

          {shareVisibility === "public" && (
            <div>
              <p className="text-sm font-medium mb-2">Share link</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <LinkIcon className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          {shareVisibility === "private" && (
            <form onSubmit={handleShareWithEmail} className="space-y-2">
              <p className="text-sm font-medium">Share with someone</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!email.trim() || loading}>
                  <Mail className="w-4 h-4 mr-1" />
                  Share
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                They must have an account with this email to view.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
