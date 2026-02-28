import { notFound } from "next/navigation";
import { getAuditById } from "@/lib/audits";
import { AuditPageClient } from "@/components/AuditPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditPage({ params }: PageProps) {
  const { id } = await params;
  const audit = await getAuditById(id);

  if (!audit) {
    notFound();
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
    />
  );
}
