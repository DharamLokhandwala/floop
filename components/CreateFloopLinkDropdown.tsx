"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AuditForm } from "@/app/AuditForm";
import { ShareFeedbackLinkModal } from "@/components/ShareFeedbackLinkModal";
import { Plus, MessageSquarePlus, Send } from "lucide-react";
import { runAudit, runRequestFeedbackLink } from "@/app/actions";

export function CreateFloopLinkDropdown() {
  const router = useRouter();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [giveModalOpen, setGiveModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalAuditId, setShareModalAuditId] = useState<string | null>(null);

  const handleRequestSuccess = (state: { auditId?: string }) => {
    if (state.auditId) {
      setRequestModalOpen(false);
      setShareModalAuditId(state.auditId);
      setShareModalOpen(true);
      router.refresh();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="!size-auto !h-auto !w-auto !min-w-0">
          <Button variant="default" className="shrink-0 bg-primary text-primary-foreground hover:!bg-primary/85 hover:!text-primary-foreground">
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create floop link</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-2">
          <DropdownMenuItem
            className="py-2.5"
            onClick={() => {
              setRequestModalOpen(true);
            }}
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Request feedback
          </DropdownMenuItem>
          <DropdownMenuItem
            className="py-2.5"
            onClick={() => {
              setGiveModalOpen(true);
            }}
          >
            <Send className="w-4 h-4 mr-2" />
            Give feedback
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get a feedback link</DialogTitle>
            <DialogDescription>
              Create a link to share with anyone. They can leave feedback on your website without signing in.
            </DialogDescription>
          </DialogHeader>
          <AuditForm
            action={runRequestFeedbackLink}
            submitLabel="Generate floop link"
            showReviewerName
            onSuccess={handleRequestSuccess}
          />
        </DialogContent>
      </Dialog>

      {shareModalAuditId && (
        <ShareFeedbackLinkModal
          auditId={shareModalAuditId}
          open={shareModalOpen}
          onOpenChange={(open) => {
            setShareModalOpen(open);
            if (!open) setShareModalAuditId(null);
          }}
          skipNameStep
        />
      )}

      <Dialog open={giveModalOpen} onOpenChange={setGiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give feedback</DialogTitle>
            <DialogDescription>
              Enter a URL and your goal. We&apos;ll capture a screenshot for you to add feedback pins.
            </DialogDescription>
          </DialogHeader>
          <AuditForm
            action={runAudit}
            submitLabel="Give feedback"
            showReviewerName
            reviewerNameLabel="Who are you sending floop to?"
            reviewerNameRequired={false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
