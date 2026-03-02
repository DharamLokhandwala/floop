import { redirect } from "next/navigation";
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
      select: { createdById: true },
    });
    if (audit?.createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: audit.createdById },
        select: { name: true, email: true },
      });
      if (creator) sharedByName = creator.name || creator.email || null;
    }
  }

  if (user) redirect(callbackUrl);

  const showVerifyMessage = params.verify === "1";
  const fromSharedAudit = !!sharedByName && callbackUrl.startsWith("/audit/");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            {showVerifyMessage
              ? "Check your email for the sign-in link."
              : fromSharedAudit
                ? `${sharedByName} has shared feedback with you. Sign in below to view it.`
                : "Sign in with your email and password, or request a sign-in link."}
          </p>
        </div>
        {showVerifyMessage ? (
          <div className="rounded-md border border-gray-500 dark:border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            If you don't see the email, check your spam folder or try again.
          </div>
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
      </div>
    </div>
  );
}
