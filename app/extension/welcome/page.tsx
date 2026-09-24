import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Globe, MousePointerClick, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowFieldBackground } from "@/components/FlowFieldBackground";

export const metadata: Metadata = {
  title: "Welcome to floop",
  description: "Give feedback directly on any live website — pin comments in context and share the review, no screenshots needed.",
};

const LOGIN_URL = "/login?callbackUrl=%2Fdashboard";

const steps = [
  {
    icon: Globe,
    title: "Open a website",
    description: "Visit the website you want to review.",
  },
  {
    icon: MousePointerClick,
    title: "Click the floop extension",
    description: "Start a review directly from your browser.",
  },
  {
    icon: MessageSquarePlus,
    title: "Leave feedback in context",
    description: "Click anywhere on the page and add your comment.",
  },
];

export default function ExtensionWelcomePage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <FlowFieldBackground
        dashColor="#E3E5FF"
        dashThickness={0.6}
        meshGradient={[
          "radial-gradient(ellipse 80% 70% at 10% 10%, #3a3cff55 0%, transparent 60%)",
          "radial-gradient(ellipse 70% 60% at 90% 5%,  #a78bfa66 0%, transparent 55%)",
          "radial-gradient(ellipse 90% 70% at 55% 95%, #6366f155 0%, transparent 60%)",
          "radial-gradient(ellipse 65% 55% at 0%  80%,  #818cf855 0%, transparent 50%)",
          "radial-gradient(ellipse 55% 45% at 95% 60%, #4f46e544 0%, transparent 45%)",
        ]}
        backgroundColor="#F8F9FF"
        noiseOpacity={0.15}
      />

      <main className="relative z-10 w-full max-w-[480px]">
        <div className="rounded-[2rem] border border-neutral-100 bg-white px-6 py-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.10)] sm:px-10 sm:py-12">
          {/* Brand */}
          <div className="flex justify-center">
            <Image
              src="/landing/floop-thin.svg"
              alt="floop"
              width={110}
              height={36}
              priority
            />
          </div>

          {/* Heading + supporting copy */}
          <div className="mt-8 space-y-3 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              Give feedback directly on any live website
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Click anywhere on a website, leave contextual feedback, and share
              the review without taking screenshots or writing long
              explanations.
            </p>
          </div>

          {/* Three-step explanation */}
          <ol className="mt-10 space-y-6">
            {steps.map(({ icon: Icon, title, description }, i) => (
              <li key={title} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="pt-1">
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Primary CTA */}
          <Button asChild size="lg" className="mt-10 h-12 w-full rounded-xl text-base">
            <Link href={LOGIN_URL}>Create a free account</Link>
          </Button>

          {/* Secondary action */}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={LOGIN_URL}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Final instruction */}
        <p className="mt-6 text-center text-xs text-muted-foreground/80">
          After signing in, open any website and click the floop extension to
          start your first review.
        </p>
      </main>
    </div>
  );
}
