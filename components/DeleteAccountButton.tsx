"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/app/dashboard/actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
      >
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Are you sure? This cannot be undone.</p>
      <div className="flex gap-2">
        <form action={deleteAccount}>
          <Button type="submit" variant="destructive">
            Yes, delete my account
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
