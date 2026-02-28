"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import type { RunAuditState } from "./actions";

interface AuditFormProps {
  action: (
    prevState: RunAuditState,
    formData: FormData
  ) => Promise<RunAuditState>;
  /** Override submit button label (default: "Give feedback") */
  submitLabel?: string;
}

export function AuditForm({ action, submitLabel = "Give feedback" }: AuditFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
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
          User Goal
        </label>
        <Textarea
          id="goal"
          name="goal"
          placeholder="e.g., Increase sign-up conversions, improve mobile UX, optimize for search visibility"
          rows={4}
          required
          disabled={isPending}
          className="w-full resize-none"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          "Creating..."
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {submitLabel}
          </>
        )}
      </Button>
    </form>
  );
}
