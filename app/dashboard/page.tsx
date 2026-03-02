import { redirect } from "next/navigation";
import {
  getAuditsCreatedByMe,
  getAuditsSharedWithMe,
  getCreatedByMeCount,
  getSharedWithMeCount,
  type AuditListItem,
  type SharedAuditListItem,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuditTableRow } from "@/components/AuditTableRow";
import { NewWebsiteModal } from "@/components/NewWebsiteModal";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { DashboardTabToggle } from "@/components/DashboardTabToggle";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { SetPasswordBanner } from "@/components/SetPasswordBanner";
import { runAudit } from "@/app/actions";

function profileCompletionPercent(user: { name: string | null; email: string | null; image: string | null }): number {
  let n = 0;
  if (user.name?.trim()) n += 50;
  if (user.email?.trim()) n += 50;
  return n;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "shared" ? "shared" : "created";
  const profileComplete = profileCompletionPercent(user);
  const [createdCount, sharedCount, createdList, sharedList] = await Promise.all([
    getCreatedByMeCount(user.id),
    getSharedWithMeCount(user.id),
    getAuditsCreatedByMe(user.id),
    getAuditsSharedWithMe(user.id),
  ]);
  const audits: AuditListItem[] = tab === "shared" ? sharedList : createdList;
  const sharedHasNewComments = sharedList.some((a) => a.newCommentsCount > 0);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    })
      .format(date)
      .replace(",", ","); // Format: "19 Feb, 26"
  };

  return (
    <div className="min-h-screen bg-background">
      {profileComplete < 100 && (
        <ProfileCompletionBanner completionPercent={profileComplete} />
      )}
      {!user.passwordHash && <SetPasswordBanner />}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Websites</h1>
            <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NewWebsiteModal action={runAudit} />
            <DashboardNavActions />
            </div>
          </div>
          <DashboardTabToggle createdCount={createdCount} sharedCount={sharedCount} sharedHasNewComments={sharedHasNewComments} />
        </div>

        {audits.length === 0 ? (
          <div className="text-center py-10 sm:py-12">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {tab === "shared"
                ? "No feedback shared with you yet."
                : "No feedback yet. Create your first one!"}
            </p>
            {tab === "created" && (
              <NewWebsiteModal action={runAudit} triggerLabel="Give feedback" />
            )}
          </div>
        ) : (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28 sm:w-32">Date</TableHead>
                  <TableHead className="w-48 sm:w-56">Website</TableHead>
                  <TableHead className="w-48 sm:w-56">User goal</TableHead>
                  {tab === "shared" && <TableHead className="w-28 shrink-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit) => (
                  <AuditTableRow
                    key={audit.id}
                    id={audit.id}
                    href={`/audit/${audit.id}`}
                    screenshotUrl={audit.screenshotUrl}
                    dateFormatted={formatDate(audit.createdAt)}
                    websiteUrl={audit.url}
                    goal={audit.goal}
                    canEdit={tab === "created"}
                    newCommentsCount={tab === "shared" ? (audit as SharedAuditListItem).newCommentsCount : undefined}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
