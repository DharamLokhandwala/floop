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
        <Button variant="default" className="w-full" style={{ backgroundColor: "var(--color-floop-blue)" }} onClick={() => setRequestModalOpen(true)}>
          Create floop link
        </Button>
      ) : directAction === "give" ? (
        <Button variant="default" className="w-full" style={{ backgroundColor: "var(--color-floop-blue)" }} onClick={() => setGiveModalOpen(true)}>
          Give feedback
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="size-auto! h-auto! w-auto! min-w-0!">
            <Button variant="default" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/85! hover:text-primary-foreground!">
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
      <ModalShell open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogHeader className="mb-7">
          <DialogTitle className="text-[1.45rem] font-semibold tracking-tight text-zinc-900">Request feedback</DialogTitle>
          <DialogDescription className="text-[1rem] text-zinc-400 leading-relaxed">
            Reviewers can leave pins on your website without signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="border-t border-zinc-100 mb-6" />
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
        <DialogHeader className="mb-7">
          <DialogTitle className="text-[1.45rem] font-semibold tracking-tight text-zinc-900">Give feedback</DialogTitle>
          <DialogDescription className="text-[1rem] text-zinc-400 leading-relaxed">
            Enter a website URL and drop pins directly on the live page.
          </DialogDescription>
        </DialogHeader>
        <div className="border-t border-zinc-100 mb-6" />
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
