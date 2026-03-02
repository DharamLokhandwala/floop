import { redirect } from "next/navigation";
import { getArchivedAuditsCreatedByMe, type AuditListItem } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuditTableRow } from "@/components/AuditTableRow";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { NewWebsiteModal } from "@/components/NewWebsiteModal";
import { BackButton } from "@/components/BackButton";
import { runAudit } from "@/app/actions";

export default async function ArchivedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const audits = await getArchivedAuditsCreatedByMe(user.id);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    })
      .format(date)
      .replace(",", ",");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
              Archived websites
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NewWebsiteModal action={runAudit} />
            <DashboardNavActions />
          </div>
        </div>

        {audits.length === 0 ? (
          <div className="text-center py-10 sm:py-12">
            <p className="text-muted-foreground text-sm sm:text-base">
              No archived websites.
            </p>
          </div>
        ) : (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28 sm:w-32">Date</TableHead>
                  <TableHead className="w-48 sm:w-56">Website</TableHead>
                  <TableHead className="w-48 sm:w-56">User goal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit: AuditListItem) => (
                  <AuditTableRow
                    key={audit.id}
                    id={audit.id}
                    href={`/audit/${audit.id}`}
                    screenshotUrl={audit.screenshotUrl}
                    dateFormatted={formatDate(audit.createdAt)}
                    websiteUrl={audit.url}
                    goal={audit.goal}
                    archived
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
