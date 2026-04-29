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
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AuditForm } from "@/app/AuditForm";
import { ShareFeedbackLinkModal } from "@/components/ShareFeedbackLinkModal";
import { Plus, MessageSquarePlus, Send } from "lucide-react";
import { runAudit, runRequestFeedbackLink } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";

export function CreateFloopLinkDropdown({ directAction }: { directAction?: "request" | "give" } = {}) {
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
      {directAction === "request" ? (
        <Button className="w-full" onClick={() => setRequestModalOpen(true)}>Create floop link</Button>
      ) : directAction === "give" ? (
        <Button className="w-full" onClick={() => setGiveModalOpen(true)}>Give feedback</Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="size-auto! h-auto! w-auto! min-w-0!">
            <Button variant="default" className="shrink-0">
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create floop link</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-2">
            <DropdownMenuItem className="py-2.5" onClick={() => setRequestModalOpen(true)}>
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Request feedback
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2.5" onClick={() => setGiveModalOpen(true)}>
              <Send className="w-4 h-4 mr-2" />
              Give feedback
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Request feedback modal */}
      <ModalShell 
        open={requestModalOpen} 
        onOpenChange={setRequestModalOpen}
        illustrationSrc="/popup-requested-feedback.svg"
      >
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <DialogHeader className="space-y-2 flex flex-col items-center text-center sm:text-center w-full">
            <DialogTitle className="text-3xl font-bold tracking-tight text-foreground text-center sm:text-center w-full">Request feedback</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[15px] max-w-[280px] mx-auto leading-relaxed text-center sm:text-center">
              Reviewers can leave pins on your website without signing in.
            </DialogDescription>
          </DialogHeader>
        </div>
        <AuditForm
          action={runRequestFeedbackLink}
          submitLabel="Generate floop link"
          showReviewerName
          onSuccess={handleRequestSuccess}
        />
      </ModalShell>

      {/* Share link modal — shown after request-feedback completes */}
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

      {/* Give feedback modal */}
      <ModalShell open={giveModalOpen} onOpenChange={setGiveModalOpen}>
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <DialogHeader className="space-y-2 flex flex-col items-center text-center sm:text-center w-full">
            <DialogTitle className="text-3xl font-bold tracking-tight text-foreground text-center sm:text-center w-full">Give feedback</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[15px] max-w-[280px] mx-auto leading-relaxed text-center sm:text-center">
              Enter a website URL and drop pins directly on the live page.
            </DialogDescription>
          </DialogHeader>
        </div>
        <AuditForm
          action={runAudit}
          submitLabel="Give feedback to others"
          showReviewerName
          reviewerNameLabel="Who are you flooping it to?"
          reviewerNameRequired={false}
          urlLabel="Website link"
          urlPlaceholder="https://example.com"
          goalLabel="Feedback's focus"
          goalPlaceholder="e.g., Increase sign-up conversions, improve mobile UX"
        />
      </ModalShell>
    </>
  );
}
