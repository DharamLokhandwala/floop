"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "set-password-banner-dismissed";

export function SetPasswordBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Link
            href="/dashboard/set-password"
            className="text-xs text-primary hover:underline"
          >
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Looks like you're new here!
          </p>
          
            Set password so you can sign in with email and password next time.
          
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8"
        aria-label="Dismiss"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
    </Link>
  );
}
