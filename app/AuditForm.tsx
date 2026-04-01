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
  /** Label for the URL field. */
  urlLabel?: string;
  /** Placeholder for the URL field. */
  urlPlaceholder?: string;
  /** Label for the goal field. */
  goalLabel?: string;
  /** Placeholder for the goal field. */
  goalPlaceholder?: string;
}

export function AuditForm({ action, submitLabel = "Give feedback", showReviewerName, reviewerNameLabel, reviewerNameRequired = true, onSuccess, urlLabel, urlPlaceholder, goalLabel, goalPlaceholder }: AuditFormProps) {
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

      <div className="space-y-1.5">
        <label htmlFor="url" className="block text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          {urlLabel ?? "Website link"}
        </label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder={urlPlaceholder ?? "https://yourwebsite.com"}
          required
          disabled={isPending}
          className="w-full h-11"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="goal" className="block text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          {goalLabel ?? "What should they focus on?"} <span className="normal-case tracking-normal font-normal text-zinc-300">(optional)</span>
        </label>
        <Textarea
          id="goal"
          name="goal"
          placeholder={goalPlaceholder ?? "e.g. Does the hero section communicate clearly? Is the about page convincing?"}
          rows={3}
          disabled={isPending}
          className="w-full resize-none"
        />
      </div>

      {showReviewerName && (
        <div className="space-y-1.5">
          <label htmlFor="reviewerName" className="block text-[11px] font-medium uppercase tracking-widest text-zinc-400">
            {reviewerNameLabel ?? "Reviewer name"}
          </label>
          <Input
            id="reviewerName"
            name="reviewerName"
            type="text"
            placeholder="e.g. Alex (from Apple)"
            required={reviewerNameRequired}
            disabled={isPending}
            className="w-full h-11"
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

      <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl text-[15px] font-medium mt-2">
        {isPending ? (
          showReviewerName ? "Generating..." : "Creating..."
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
