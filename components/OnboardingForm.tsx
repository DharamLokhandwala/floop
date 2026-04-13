"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingState } from "@/app/onboarding/actions";

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={`transition-colors duration-150 ${
        met ? "line-through text-muted-foreground/50" : "text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export function OnboardingForm({
  action,
}: {
  action: (prev: OnboardingState, formData: FormData) => Promise<OnboardingState>;
}) {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(action, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const rules = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordsMatch = password.length > 0 && confirm.length > 0 && password === confirm;
  const showMatchIndicator = confirm.length > 0;

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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            placeholder="At least 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <p className="text-xs w-full flex flex-wrap gap-x-4 gap-y-1">
              <PasswordRule met={rules.length} label="12 characters minimum" />
              <PasswordRule met={rules.uppercase} label="One uppercase" />
              <PasswordRule met={rules.number} label="One number" />
              <PasswordRule met={rules.special} label="One special character" />
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {showMatchIndicator && (
          <p
            className={`text-xs transition-colors duration-150 ${
              passwordsMatch ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            }`}
          >
            {passwordsMatch ? "Passwords match" : "Passwords do not match yet"}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Setting up…" : "Get started"}
      </Button>
    </form>
  );
}
