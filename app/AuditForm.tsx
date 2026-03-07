"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RunAuditState } from "./actions";

interface AuditFormProps {
  action: (
    prevState: RunAuditState,
    formData: FormData
  ) => Promise<RunAuditState>;
  /** Override submit button label (default: "Give feedback") */
  submitLabel?: string;
  /** When true, show the "who are you sending floop to" / "who are you sharing to" field. */
  showReviewerName?: boolean;
  /** Label for the reviewer name field (e.g. "Who are you sending floop to?" for give feedback). */
  reviewerNameLabel?: string;
  /** When true, reviewer name is required (e.g. request-feedback). When false, optional (e.g. give feedback). */
  reviewerNameRequired?: boolean;
  /** Called when action returns successfully with auditId (e.g. request-feedback flow). */
  onSuccess?: (state: RunAuditState) => void;
}

export function AuditForm({ action, submitLabel = "Give feedback", showReviewerName, reviewerNameLabel, reviewerNameRequired = true, onSuccess }: AuditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastAuditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state?.auditId && state.auditId !== lastAuditIdRef.current && onSuccess) {
      lastAuditIdRef.current = state.auditId;
      onSuccess(state);
    }
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Used to track whether the user has confirmed they want to proceed on an insecure site. */}
      <input
        type="hidden"
        name="ignoreInsecure"
        value={state?.insecureCertificate ? "true" : "false"}
      />

      {state?.error && !state?.insecureCertificate && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.insecureCertificate && (
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Website is not secure</DialogTitle>
              <DialogDescription>
                {state.error ??
                  "This website's security certificate appears to be invalid or expired. You can still proceed, but only if you trust this site."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  if (formRef.current) {
                    formRef.current.requestSubmit();
                  }
                }}
              >
                {isPending ? "Proceeding..." : "Proceed anyway"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-2">
        <label htmlFor="url" className="text-sm font-medium">
          Website URL
        </label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder="https://example.com"
          required
          disabled={isPending}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="goal" className="text-sm font-medium">
          User Goal <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Textarea
          id="goal"
          name="goal"
          placeholder="e.g., Increase sign-up conversions, improve mobile UX, optimize for search visibility"
          rows={4}
          disabled={isPending}
          className="w-full resize-none"
        />
      </div>

      {showReviewerName && (
        <div className="space-y-2">
          <label htmlFor="reviewerName" className="text-sm font-medium">
            {reviewerNameLabel ?? "Who are you sharing to?"}
            {reviewerNameRequired && <span className="text-destructive"> *</span>}
          </label>
          <Input
            id="reviewerName"
            name="reviewerName"
            type="text"
            placeholder="e.g. Alex, Design team"
            required={reviewerNameRequired}
            disabled={isPending}
            className="w-full"
          />
        </div>
      )}

      {isPending && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {showReviewerName ? "Creating your floop link" : "Just a few a seconds to floop"}
            </span>
            <span className="flex gap-1.5 items-center">
              <span
                className="size-2 rounded-full bg-primary animate-generating-dot"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-2 rounded-full bg-primary animate-generating-dot"
                style={{ animationDelay: "200ms" }}
              />
              <span
                className="size-2 rounded-full bg-primary animate-generating-dot"
                style={{ animationDelay: "400ms" }}
              />
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full w-1/3 rounded-full bg-primary/80 animate-generating-shimmer"
              aria-hidden
            />
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          showReviewerName ? "Generating..." : "Creating..."
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
