import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { NewWebsiteModal } from "@/components/NewWebsiteModal";
import { BackButton } from "@/components/BackButton";
import { runAudit } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [totalAudits, archivedCount] = await Promise.all([
    prisma.audit.count({ where: { archived: false } }),
    prisma.audit.count({ where: { archived: true } }),
  ]);

  const lastAudit = await prisma.audit.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
              Profile
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NewWebsiteModal action={runAudit} />
            <DashboardNavActions />
          </div>
        </div>

        <div className="space-y-8 max-w-xl mx-auto">
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Your information</h2>
            <div className="rounded-lg border border-gray-500 dark:border-border bg-card p-4 space-y-2">
              <div>
                <span className="text-muted-foreground text-sm">Name</span>
                <p className="font-medium">{user.name ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Email</span>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <ProfileForm defaultName={user.name ?? ""} defaultEmail={user.email ?? ""} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-medium">Activity</h2>
            <div className="rounded-lg border border-gray-500 dark:border-border bg-card p-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold">{totalAudits}</p>
                <p className="text-muted-foreground text-sm">Websites with feedback</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{archivedCount}</p>
                <p className="text-muted-foreground text-sm">Archived</p>
              </div>
              <div>
                <p className="text-lg font-medium">
                  {lastAudit
                    ? new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(lastAudit.createdAt)
                    : "—"}
                </p>
                <p className="text-muted-foreground text-sm">Last feedback</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
