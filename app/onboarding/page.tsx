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
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-[#7B8CF6] rounded-[2rem] flex flex-col md:flex-row shadow-2xl overflow-hidden md:min-h-[600px]">
        {/* Left Side: Form Container */}
        <div className="w-full md:w-1/2 bg-background m-3 rounded-[1.5rem] p-8 md:p-12 flex flex-col shrink-0">
          <div className="max-w-sm w-full mx-auto flex flex-col h-full">
            <div className="flex flex-col h-full w-full">
              <div className="flex-1 flex flex-col justify-center w-full">
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Set up your profile</h1>
                    <p className="text-muted-foreground text-[15px] max-w-[280px] mx-auto leading-relaxed">
                      Let us help you get started with floop.
                    </p>
                  </div>
                </div>
                <OnboardingForm action={completeOnboarding} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Illustration Container */}
        <div className="hidden md:flex w-full md:w-1/2 items-center justify-center p-12">
          <Image
            src="/onboarding-profile.svg"
            alt="Onboarding profile setup"
            width={400}
            height={400}
            className="w-full max-w-[320px] h-auto object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
