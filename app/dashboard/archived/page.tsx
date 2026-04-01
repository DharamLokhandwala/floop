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
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { CreateFloopLinkDropdown } from "@/components/CreateFloopLinkDropdown";
import { BackButton } from "@/components/BackButton";
import { ArchivedAuditList } from "./ArchivedAuditList";

export default async function ArchivedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const audits = await getArchivedAuditsCreatedByMe(user.id);

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
            <CreateFloopLinkDropdown />
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
          <ArchivedAuditList audits={audits} />
        )}
      </div>
    </div>
  );
}
