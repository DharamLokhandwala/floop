import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { NewWebsiteModal } from "@/components/NewWebsiteModal";
import { BackButton } from "@/components/BackButton";
import { runAudit } from "@/app/actions";
import { SetPasswordForm } from "@/components/SetPasswordForm";
import { setPassword, type PasswordState } from "@/app/dashboard/actions";

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.passwordHash) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
              Set your password
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NewWebsiteModal action={runAudit} />
            <DashboardNavActions />
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <p className="text-muted-foreground text-sm">
            Set a password so you can sign in with your email and password next time, without using a link.
          </p>
          <SetPasswordForm action={setPassword} />
        </div>
      </div>
    </div>
  );
}
