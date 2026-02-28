"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="rounded-full border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 -ml-2"
      onClick={() => router.back()}
      aria-label="Go back"
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  );
}
