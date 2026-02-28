"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AuditForm } from "@/app/AuditForm";
import { Plus } from "lucide-react";
import type { RunAuditState } from "@/app/actions";

interface NewWebsiteModalProps {
  action: (prevState: RunAuditState, formData: FormData) => Promise<RunAuditState>;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function NewWebsiteModal({
  action,
  triggerLabel = "New website",
  triggerVariant = "default",
}: NewWebsiteModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New website</DialogTitle>
            <DialogDescription>
              Enter a URL and your goal. We&apos;ll capture a screenshot for you to add manual feedback pins.
            </DialogDescription>
          </DialogHeader>
          <AuditForm action={action} submitLabel="Give Feedback" />
        </DialogContent>
      </Dialog>
    </>
  );
}
