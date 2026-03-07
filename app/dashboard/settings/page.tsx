import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { NewWebsiteModal } from "@/components/NewWebsiteModal";
import { BackButton } from "@/components/BackButton";
import { runAudit } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsNotificationsForm } from "@/components/SettingsNotificationsForm";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
              Settings
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NewWebsiteModal action={runAudit} />
            <DashboardNavActions />
          </div>
        </div>

        <div className="space-y-10 max-w-xl mx-auto">
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Sign-in</h2>
            <div className="rounded-lg border border-gray-500 dark:border-border bg-card p-4">
              {user.passwordHash ? (
                <p className="text-sm text-muted-foreground">
                  Your account is set up to sign in with your email and password.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You signed up with an email link. Set a password to sign in with email and password next time.{" "}
                  <Link href="/dashboard/set-password" className="text-primary hover:underline">
                    Set password
                  </Link>
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-medium">Notification email settings</h2>
            <div className="rounded-lg border border-gray-500 dark:border-border bg-card p-4">
              <SettingsNotificationsForm
                notifyOnAuditComplete={user.notifyOnAuditComplete}
                notifyWeeklyDigest={user.notifyWeeklyDigest}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-medium text-destructive">Danger zone</h2>
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
              <DeleteAccountButton />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
