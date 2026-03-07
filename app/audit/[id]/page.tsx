import { notFound, redirect } from "next/navigation";
import {
  getAuditById,
  canViewAudit,
  addPublicAuditToSharedWithMe,
  updateLastSeenForSharedAudit,
  updateOwnerLastSeenForAudit,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditPageClient } from "@/components/AuditPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ linkCreated?: string; view?: string }>;
}

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const linkCreated = resolvedSearchParams.linkCreated === "1";
  const audit = await getAuditById(id);

  if (!audit) {
    notFound();
  }

  const shareVisibility = (audit.shareVisibility as "public" | "private") || "private";
  const mode = audit.mode ?? "give_feedback";
  const isRequestFeedback = mode === "request_feedback";
  const user = await getCurrentUser();

  if (!user) {
    if (shareVisibility === "public") {
      let sharedByName: string | null = null;
      if (audit.createdById) {
        const creator = await prisma.user.findUnique({
          where: { id: audit.createdById },
          select: { name: true, email: true },
        });
        if (creator) sharedByName = creator.name || creator.email || null;
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
          isOwner={false}
          isAuthenticated={false}
          sharedByName={sharedByName}
          allowAnonymousComments={isRequestFeedback}
          linkCreated={false}
          isRequestFeedback={isRequestFeedback}
        />
      );
    }

    const callbackUrl = `/audit/${id}?view=shared`;
    const search = new URLSearchParams({
      callbackUrl,
      fromAuditId: id,
    }).toString();
    redirect(`/login?${search}`);
  }

  const allowed = await canViewAudit(id, user.id);
  if (!allowed) {
    notFound();
  }
  const createdById = audit.createdById;
  const isOwner = !!createdById && createdById === user.id;

  if (isOwner) {
    // Track the owner's last seen comment count for \"Floops requested\" new-comment indicators.
    await updateOwnerLastSeenForAudit(id, user.id, audit.userPins.length);
  } else {
    // For non-owners viewing a public audit, keep the existing \"shared with me\" tracking.
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
      linkCreated={linkCreated}
      isRequestFeedback={isRequestFeedback}
    />
  );
}
