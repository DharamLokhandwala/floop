import Link from "next/link";
import { Linkedin, Mail } from "lucide-react";
import { HeroSection } from "@/components/landing/HeroSection";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shrink-0">
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/"
            className="shrink-0 hover:opacity-90 transition-opacity flex items-center"
            aria-label="floop"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/floop-thin.svg"
              alt="floop"
              className="h-6 sm:h-7 w-auto"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Login
            </Link>
            {/* <Link href="/dashboard">
              <Button className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20 px-3 sm:px-5 text-xs sm:text-base py-2 sm:py-2.5">
                Get early access
              </Button>
            </Link> */}
          </div>
        </div>
      </header>

      <main className="flex-1 flex min-w-0">
        <HeroSection />
      </main>

      {/* <footer className="shrink-0 border-t border-border/60 bg-white py-4">
        <div className="container max-w-6xl mx-auto px-4 grid grid-cols-3 items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <a
              href="https://linkedin.com/company/floop-it"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href="mailto:founder@floop.design"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
          <p className="text-center text-muted-foreground/90 font-base">Built with care</p>
          <div className="flex items-center justify-end gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors font-s">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms and conditions
            </Link>
          </div>
        </div>
      </footer> */}
    </div>
  );
}
