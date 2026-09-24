import { randomUUID } from "crypto";
import {
  addUserPin as addPinToDb,
  canViewAudit,
  isAuditPinConflictError,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Pin } from "@/types/audit";
import { deletePinAudio, uploadPinAudio } from "@/lib/audio-blobs";
import { validate as isUuid } from "uuid";

type AddPinBody = Partial<Pin> & Record<string, unknown>;

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  const allowed = await canViewAudit(id, user?.id ?? null);
  if (!allowed) {
    return NextResponse.json(
      {
        error: user
          ? "You do not have access to this audit"
          : "Sign in to add a comment",
      },
      { status: user ? 403 : 401 }
    );
  }
  try {
    let body: AddPinBody;
    let audioFile: File | null = null;
    let uploadedAudioPathname: string | null = null;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const pinJson = formData.get("pin");
      if (typeof pinJson !== "string") {
        return NextResponse.json({ error: "Pin data is required" }, { status: 400 });
      }
      const parsed = JSON.parse(pinJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid pin data" }, { status: 400 });
      }
      body = parsed as AddPinBody;
      const audioEntry = formData.get("audio");
      if (audioEntry && typeof audioEntry !== "string") {
        audioFile = audioEntry as File;
      }
    } else {
      const parsed = (await request.json()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid pin data" }, { status: 400 });
      }
      body = parsed as AddPinBody;
    }

    if (
      typeof body.x !== "number" ||
      !Number.isFinite(body.x) ||
      typeof body.y !== "number" ||
      !Number.isFinite(body.y) ||
      typeof body.feedback !== "string" ||
      !body.feedback.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid pin data: x, y, and feedback required" },
        { status: 400 }
      );
    }

    if (
      body.id !== undefined &&
      (typeof body.id !== "string" || !isUuid(body.id.trim()))
    ) {
      return NextResponse.json({ error: "Invalid pin ID" }, { status: 400 });
    }

    const pin: Pin = {
      id: typeof body.id === "string" ? body.id.trim() : randomUUID(),
      x: body.x,
      y: body.y,
      category: body.category ?? "Feedback",
      feedback: body.feedback.trim(),
      pageUrl: body.pageUrl,
      selector: body.selector,
      viewportWidth: body.viewportWidth,
      viewportHeight: body.viewportHeight,
      scrollX: body.scrollX,
      scrollY: body.scrollY,
      docX: body.docX,
      docY: body.docY,
      ...(user ? { authorId: user.id, authorName: user.name || user.email || undefined } : {}),
    };

    if (audioFile) {
      const uploaded = await uploadPinAudio(id, audioFile);
      pin.audioUrl = uploaded.audioUrl;
      uploadedAudioPathname = uploaded.pathname;
    }

    // Optional: capture screenshot for this comment (Workflow-style). Commented out — slows submit and is not core flow.
    // if (pin.pageUrl && typeof pin.viewportWidth === "number" && typeof pin.viewportHeight === "number") {
    //   try {
    //     const buffer = await captureViewportScreenshot(pin.pageUrl, {
    //       width: Math.min(pin.viewportWidth, 1920),
    //       height: Math.min(pin.viewportHeight, 1080),
    //     });
    //     pin.screenshotUrl = await uploadScreenshotToBlob(buffer);
    //   } catch (err) {
    //     console.error("Comment screenshot capture failed:", err);
    //   }
    // }

    try {
      const result = await addPinToDb(id, pin);
      if (!result.created && pin.audioUrl) {
        // The original request already committed this ID. Discard the new
        // upload produced by this replay instead of leaking an orphan Blob.
        await deletePinAudio(id, pin.audioUrl);
      }
    } catch (error) {
      if (pin.audioUrl) {
        try {
          await deletePinAudio(id, pin.audioUrl);
        } catch (cleanupError) {
          console.error("[add-pin] Failed to roll back uploaded audio", {
            auditId: id,
            pathname: uploadedAudioPathname,
            cleanupError,
          });
        }
      }
      throw error;
    }
    revalidatePath(`/audit/${id}`);

    return NextResponse.json({ success: true, pinId: pin.id });
  } catch (error) {
    console.error("Error adding pin:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add pin",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: isAuditPinConflictError(error) ? 409 : 500 }
    );
  }
}
