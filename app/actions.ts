"use server";

import { redirect } from "next/navigation";
import { captureScreenshot, uploadScreenshotToBlob } from "@/lib/capture";
// AI analysis disabled - manual pinning only
// import { analyzeScreenshot } from "@/lib/analyze";
import { createAudit } from "@/lib/audits";
import { isValidUrl, normalizeUrl, validateGoal } from "@/lib/validation";
import { v4 } from "uuid";

export type RunAuditState = {
  error?: string;
};

export async function runAudit(
  _prevState: RunAuditState,
  formData: FormData
): Promise<RunAuditState> {
  const rawUrl = formData.get("url") as string;
  const goal = formData.get("goal") as string;

  if (!rawUrl?.trim()) {
    return { error: "URL is required" };
  }
  const url = normalizeUrl(rawUrl);
  if (!isValidUrl(url)) {
    return { error: "Please enter a valid URL (http or https)" };
  }

  const goalError = validateGoal(goal ?? "");
  if (goalError) {
    return { error: goalError };
  }

  try {
    const buffer = await captureScreenshot(url);
    const screenshotUrl = await uploadScreenshotToBlob(buffer);
    
    // AI analysis disabled - using manual pinning only
    // const pins = await analyzeScreenshot({
    //   screenshotUrl,
    //   goal: (goal ?? "").trim(),
    // });
    const pins: never[] = []; // Empty array - users will add pins manually

    const id = v4();
    await createAudit({
      id,
      url,
      goal: (goal ?? "").trim(),
      screenshotUrl,
      pins,
    });

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
