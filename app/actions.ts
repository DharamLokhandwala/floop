"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { captureScreenshot, captureHeroScreenshot, uploadScreenshotToBlob } from "@/lib/capture";
import { createAudit, setShareVisibility, setReviewerName } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { isValidUrl, normalizeUrl, validateGoal } from "@/lib/validation";
import { v4 } from "uuid";
import { prisma } from "@/lib/db";

export type RunAuditState = {
  error?: string;
  /** True when we hit an insecure/invalid TLS certificate and asked the user whether to proceed. */
  insecureCertificate?: boolean;
  /** When set, request-feedback audit was created; client should show share modal instead of redirecting. */
  auditId?: string;
};

export async function runAudit(
  _prevState: RunAuditState,
  formData: FormData
): Promise<RunAuditState> {
  const rawUrl = formData.get("url") as string;
  const goal = formData.get("goal") as string;
  const reviewerName = (formData.get("reviewerName") as string)?.trim() ?? "";
  const ignoreInsecure =
    (formData.get("ignoreInsecure") as string | null) === "true";

  if (!rawUrl?.trim()) {
    return { error: "URL is required" };
  }
  const url = normalizeUrl(rawUrl);
  if (!isValidUrl(url)) {
    return { error: "Please enter a valid URL (http or https)" };
  }

  const goalTrimmed = (goal ?? "").trim();
  if (goalTrimmed) {
    const goalError = validateGoal(goalTrimmed);
    if (goalError) return { error: goalError };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to create feedback" };
  }

  try {
    const id = v4();
    await createAudit({
      id,
      url,
      goal: goalTrimmed,
      screenshotUrl: "",
      pins: [],
      createdById: user.id,
    });
    if (reviewerName) {
      await setReviewerName(id, user.id, reviewerName);
    }
    
    // Capture screenshot asynchronously so the user gets instantly redirected to the audit page
    after(async () => {
      try {
        const buffer = await captureScreenshot(url, ignoreInsecure);
        const screenshotUrl = await uploadScreenshotToBlob(buffer);
        await prisma.audit.update({
          where: { id },
          data: { screenshotUrl },
        });
      } catch (err) {
        console.error("Deferred background screenshot capture failed:", err);
      }
    });

    revalidatePath("/dashboard");

    redirect(`/audit/${id}`);
  } catch (err) {
    // Re-throw redirect errors (Next.js handles these specially)
    if (err && typeof err === "object" && "digest" in err) {
      const digest = (err as { digest?: string }).digest;
      if (digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
    }

    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    return { error: message };
  }
}

/** Creates a request-feedback audit (hero screenshot only), sets public. Returns auditId so client can show share modal (no redirect). */
export async function runRequestFeedbackLink(
  _prevState: RunAuditState,
  formData: FormData
): Promise<RunAuditState> {
  const rawUrl = formData.get("url") as string;
  const goal = formData.get("goal") as string;
  const reviewerName = (formData.get("reviewerName") as string)?.trim() ?? "";
  const ignoreInsecure =
    (formData.get("ignoreInsecure") as string | null) === "true";

  if (!rawUrl?.trim()) {
    return { error: "URL is required" };
  }
  const url = normalizeUrl(rawUrl);
  if (!isValidUrl(url)) {
    return { error: "Please enter a valid URL (http or https)" };
  }

  const goalTrimmed = (goal ?? "").trim();
  if (goalTrimmed) {
    const goalError = validateGoal(goalTrimmed);
    if (goalError) return { error: goalError };
  }

  if (!reviewerName) {
    return { error: "Oh, did you enter the name? Who are you sharing to?" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to create a feedback link" };
  }

  try {
    const id = v4();
    await createAudit({
      id,
      url,
      goal: goalTrimmed,
      screenshotUrl: "",
      pins: [],
      createdById: user.id,
      mode: "request_feedback",
    });
    await setShareVisibility(id, "public", user.id);
    await setReviewerName(id, user.id, reviewerName);
    
    // Capture hero screenshot asynchronously so the user instantly gets their share link
    after(async () => {
      try {
        const buffer = await captureHeroScreenshot(url, ignoreInsecure);
        const screenshotUrl = await uploadScreenshotToBlob(buffer);
        await prisma.audit.update({
          where: { id },
          data: { screenshotUrl },
        });
      } catch (err) {
        console.error("Deferred background hero screenshot capture failed:", err);
      }
    });

    revalidatePath("/dashboard");
    return { auditId: id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return { error: message };
  }
}
