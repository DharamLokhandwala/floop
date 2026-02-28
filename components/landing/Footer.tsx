import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-white">
      <div className="container max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 sm:gap-8">
            <Link
              href="/"
              className="font-bold text-foreground hover:text-primary transition-colors tracking-tight"
            >
              floop
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            © {currentYear} floop. Feedback on any website, in one place.
          </p>
        </div>
      </div>
    </footer>
  );
}
