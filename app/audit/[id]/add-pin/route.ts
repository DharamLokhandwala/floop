import { addUserPin as addPinToDb } from "@/lib/audits";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Pin } from "@/types/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const pin: Pin = {
      x: body.x,
      y: body.y,
      category: body.category ?? "Feedback",
      feedback: body.feedback,
      pageUrl: body.pageUrl,
      selector: body.selector,
      viewportWidth: body.viewportWidth,
      viewportHeight: body.viewportHeight,
      scrollX: body.scrollX,
      scrollY: body.scrollY,
    };

    if (
      typeof pin.x !== "number" ||
      typeof pin.y !== "number" ||
      !pin.feedback
    ) {
      return NextResponse.json(
        { error: "Invalid pin data: x, y, and feedback required" },
        { status: 400 }
      );
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

    await addPinToDb(id, pin);
    revalidatePath(`/audit/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding pin:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add pin",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
