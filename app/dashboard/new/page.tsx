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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-medium tracking-tight">Start a review</h1>
          <p className="text-sm text-muted-foreground">
            {defaultUrl
              ? "We prefilled the website from your browser tab. Confirm to start giving feedback."
              : "Enter a website URL to review."}
          </p>
        </div>
        <AuditForm
          action={runAudit}
          defaultUrl={defaultUrl}
          minimal
          submitLabel="Start giving feedback"
          urlLabel="Website link"
          urlPlaceholder="https://example.com"
        />
      </div>
    </div>
  );
}
