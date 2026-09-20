import { notFound } from "next/navigation";
import {
  getAuditById,
  addPublicAuditToSharedWithMe,
  updateLastSeenForSharedAudit,
  updateOwnerLastSeenForAudit,
} from "@/lib/audits";
import { createAuditViewerAccessToken } from "@/lib/audit-viewer-access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditPageClient } from "@/components/AuditPageClient";
import { LoginForm } from "@/components/LoginForm";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ linkCreated?: string; view?: string }>;
}

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const linkCreated = resolvedSearchParams.linkCreated === "1";
  const user = await getCurrentUser();
  const viewerAccessToken = await createAuditViewerAccessToken(id, user?.id ?? null);

  if (!viewerAccessToken) {
    // Fetch only the metadata needed for the sign-in screen. Pin JSON is never
    // loaded into this unauthorized server-rendering branch or sent to the client.
    const deniedAudit = await prisma.audit.findUnique({
      where: { id },
      select: {
        creator: { select: { name: true, email: true } },
      },
    });
    if (!deniedAudit || user) {
      notFound();
    }

    const sharedByName =
      deniedAudit.creator?.name || deniedAudit.creator?.email || null;
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoginForm
          callbackUrl={`/audit/${id}?view=shared`}
          sharedByName={sharedByName}
        />
      </main>
    );
  }

  const audit = await getAuditById(id);
  if (!audit) {
    notFound();
  }

  const shareVisibility =
    (audit.shareVisibility as "public" | "private") || "private";
  const mode = audit.mode ?? "give_feedback";
  const isRequestFeedback = mode === "request_feedback";
  const isOwner = !!user && !!audit.createdById && audit.createdById === user.id;

  if (user && isOwner) {
    // Track the owner's last seen comment count for "Floops requested" new-comment indicators.
    await updateOwnerLastSeenForAudit(id, user.id, audit.userPins.length);
  } else if (user) {
    // For non-owners viewing a public audit, keep the existing "shared with me" tracking.
    await addPublicAuditToSharedWithMe(id, user.id);
    await updateLastSeenForSharedAudit(id, user.id, audit.userPins.length);
  }

  return (
    <AuditPageClient
      auditId={id}
      url={audit.url}
      goal={audit.goal}
      screenshotUrl={audit.screenshotUrl}
      pins={audit.pins}
      userPins={audit.userPins}
      createdAt={audit.createdAt}
      shareVisibility={shareVisibility}
      isOwner={isOwner}
      isAuthenticated={!!user}
      allowAnonymousComments={!user && isRequestFeedback}
      linkCreated={linkCreated}
      isRequestFeedback={isRequestFeedback}
      currentUserId={user?.id}
      viewerAccessToken={viewerAccessToken}
    />
  );
}
