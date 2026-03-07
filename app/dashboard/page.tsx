import { redirect } from "next/navigation";
import {
  getAuditsRequestedByMe,
  getAuditsGivenByMe,
  getRequestedByMeCount,
  getGivenByMeCount,
  type SharedAuditListItem,
  type RequestedAuditListItem,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreateFloopLinkDropdown } from "@/components/CreateFloopLinkDropdown";
import { DashboardAuditView } from "@/components/DashboardAuditView";
import { DashboardNavActions } from "@/components/DashboardNavActions";
import { DashboardTabToggle } from "@/components/DashboardTabToggle";
import { ViewToggle } from "@/components/ViewToggle";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { SetPasswordBanner } from "@/components/SetPasswordBanner";

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
  const tab = params.tab === "given" ? "given" : "requested";
  const profileComplete = profileCompletionPercent(user);
  const [requestedCount, givenCount, requestedList, givenList] = await Promise.all([
    getRequestedByMeCount(user.id),
    getGivenByMeCount(user.id),
    getAuditsRequestedByMe(user.id),
    getAuditsGivenByMe(user.id),
  ]);
  const requestedHasFeedback = requestedList.some((a) => (a as RequestedAuditListItem).newCommentsCount > 0);
  const givenHasNewComments = givenList.some((a) => a.newCommentsCount > 0);

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
            <CreateFloopLinkDropdown />
            <DashboardNavActions />
            </div>
          </div>
          <div className="flex items-center justify-between w-full">
            <DashboardTabToggle requestedCount={requestedCount} givenCount={givenCount} requestedHasFeedback={requestedHasFeedback} givenHasNewComments={givenHasNewComments} />
            <ViewToggle />
          </div>
        </div>

        {(tab === "given" ? givenList : requestedList).length === 0 ? (
          <div className="text-center py-10 sm:py-12">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {tab === "given"
                ? "No floops given yet. Give feedback or check shared links."
                : "Incredible websites are built with feedbacks. Create your first floop link for feedbacks!"}
            </p>
            <CreateFloopLinkDropdown />
          </div>
        ) : (
          <DashboardAuditView
            requestedList={requestedList as unknown as { id: string; url: string; goal: string; screenshotUrl: string; createdAt: string; feedbackCount: number; reviewerName?: string | null; newCommentsCount: number }[]}
            givenList={givenList as unknown as { id: string; url: string; goal: string; screenshotUrl: string; createdAt: string; feedbackCount: number; newCommentsCount: number; isOwner?: boolean; reviewerName?: string | null }[]}
            tab={tab}
          />
        )}
      </div>
    </div>
  );
}
