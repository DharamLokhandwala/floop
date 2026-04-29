"use client";

import { ArrowLeft } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutBackButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
      aria-label="Go back and sign out"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </button>
  );
}
