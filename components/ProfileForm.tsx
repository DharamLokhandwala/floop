"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile, type ProfileState } from "@/app/dashboard/actions";

interface ProfileFormProps {
  defaultName: string;
  defaultEmail: string;
}

export function ProfileForm({ defaultName, defaultEmail }: ProfileFormProps) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateProfile,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md px-3 py-2">
          {state.success}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor="profile-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="profile-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="profile-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          required
        />
      </div>
      <Button type="submit">Update profile</Button>
    </form>
  );
}
