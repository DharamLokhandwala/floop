import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/OnboardingForm";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.name) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/floop-thin.png"
            alt="floop"
            width={56}
            height={56}
            className="object-contain"
          />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to floop</h1>
            <p className="text-muted-foreground text-sm">
              Set up your profile to get started.
            </p>
          </div>
        </div>

        <OnboardingForm action={completeOnboarding} />
      </div>
    </div>
  );
}
