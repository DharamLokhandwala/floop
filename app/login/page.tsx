import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const showVerifyMessage = params.verify === "1";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            {showVerifyMessage
              ? "Check your email for the sign-in link."
              : "Enter your email and we'll send you a sign-in link."}
          </p>
        </div>
        {showVerifyMessage ? (
          <div className="rounded-md border border-gray-500 dark:border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            If you don't see the email, check your spam folder or try again.
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
}
