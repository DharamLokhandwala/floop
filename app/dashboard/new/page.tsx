import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { runAudit } from "@/app/actions";
import { AuditForm } from "@/app/AuditForm";
import { isValidUrl, normalizeUrl } from "@/lib/validation";

/**
 * Landing page for the floop Chrome extension launcher.
 *
 * The extension opens `/dashboard/new?url=<active tab url>`. We re-validate the
 * URL here (http/https only) rather than trusting the extension, then prefill the
 * existing AuditForm. The user must confirm by submitting — we never auto-create.
 */
export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  // Mirror the dashboard's auth guards. Middleware already protects /dashboard/*,
  // but runAudit needs a signed-in, onboarded user, so guard here too.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.name) redirect("/onboarding");

  const params = await searchParams;
  const raw = params.url?.trim();

  // Server-side re-validation: only accept http/https. Anything else is ignored
  // and the form renders empty.
  let defaultUrl: string | undefined;
  if (raw) {
    const normalized = normalizeUrl(raw);
    if (isValidUrl(normalized)) {
      defaultUrl = normalized;
    }
  }

  let hostname: string | undefined;
  if (defaultUrl) {
    try {
      hostname = new URL(defaultUrl).hostname;
    } catch {
      hostname = undefined;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-medium tracking-tight">
            {defaultUrl ? "Review this website" : "Review a website"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {defaultUrl
              ? "Make sure this is the page you want feedback on. You can edit the website below before starting."
              : "Enter a website URL to review."}
          </p>
        </div>
        {hostname && (
          <div className="mb-5 inline-flex max-w-full items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground truncate">
            {hostname}
          </div>
        )}
        <AuditForm
          action={runAudit}
          defaultUrl={defaultUrl}
          minimal
          submitLabel="Start reviewing"
          urlLabel="Website link"
          urlPlaceholder="https://example.com"
        />
      </div>
    </div>
  );
}
