"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "set-password-banner-dismissed";

const iconBg = "bg-[#f1f0f8] dark:bg-violet-500/15";

export function SetPasswordBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-border bg-white dark:bg-card px-4 py-3.5 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <Link
        href="/dashboard/set-password"
        className="flex items-center gap-4 min-w-0 flex-1 no-underline text-foreground hover:opacity-90 transition-opacity"
      >
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/set-password.svg" alt="" className="h-18 w-18" />
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Set your password, flooper!
          </p>
          <p className="text-sm text-muted-foreground leading-tight">
            Looks like you haven&apos;t setup password yet, <br /> let&apos;s do it!
          </p>
        </div>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 rounded-full"
        aria-label="Dismiss"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
