import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; callbackUrl?: string; fromAuditId?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/dashboard";

  let sharedByName: string | null = null;
  if (params.fromAuditId) {
    const audit = await prisma.audit.findUnique({
      where: { id: params.fromAuditId },
    });
    const createdById = audit ? (audit as { createdById?: string | null }).createdById : null;
    if (createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: createdById },
        select: { name: true, email: true },
      });
      if (creator) sharedByName = creator.name || creator.email || null;
    }
  }

  if (user) redirect(callbackUrl);

  const showVerifyMessage = params.verify === "1";
  const fromSharedAudit = !!sharedByName && callbackUrl.startsWith("/audit/");

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <LoginForm callbackUrl={callbackUrl} variant={showVerifyMessage ? "resend" : "default"} sharedByName={sharedByName} />
    </div>
  );
}
