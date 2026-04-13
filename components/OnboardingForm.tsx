"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingState } from "@/app/onboarding/actions";

export function OnboardingForm({
  action,
}: {
  action: (prev: OnboardingState, formData: FormData) => Promise<OnboardingState>;
}) {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Your name
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoFocus
          required
          placeholder="Jane Smith"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repeat password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Setting up…" : "Get started"}
      </Button>
    </form>
  );
}
