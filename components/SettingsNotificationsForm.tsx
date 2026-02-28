"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateNotificationSettings,
  type NotificationsState,
} from "@/app/dashboard/actions";

interface SettingsNotificationsFormProps {
  notifyOnAuditComplete: boolean;
  notifyWeeklyDigest: boolean;
}

export function SettingsNotificationsForm({
  notifyOnAuditComplete,
  notifyWeeklyDigest,
}: SettingsNotificationsFormProps) {
  const [state, formAction] = useActionState<NotificationsState, FormData>(
    updateNotificationSettings,
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
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="notifyOnAuditComplete"
          defaultChecked={notifyOnAuditComplete}
          className="rounded border-input"
        />
        <span className="text-sm">Email me when feedback is ready</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="notifyWeeklyDigest"
          defaultChecked={notifyWeeklyDigest}
          className="rounded border-input"
        />
        <span className="text-sm">Weekly digest email</span>
      </label>
      <Button type="submit">Save notification settings</Button>
    </form>
  );
}
