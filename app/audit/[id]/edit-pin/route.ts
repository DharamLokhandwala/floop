import { updatePinFeedback, getAuditById } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({ error: "Sign in to edit a comment" }, { status: 401 });
  }

  try {
    const { pinId, feedback } = await request.json();

    if (!pinId || !feedback || typeof feedback !== "string") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const audit = await getAuditById(id);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const allPins = [...audit.pins, ...audit.userPins];
    const pin = allPins.find((p) => p.id === pinId);
    if (!pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    // Only the author or the audit owner can edit
    if (pin.authorId !== user.id && audit.createdById !== user.id) {
      return NextResponse.json({ error: "You do not have permission to edit this comment" }, { status: 403 });
    }

    await updatePinFeedback(id, pinId, feedback.trim());
    revalidatePath(`/audit/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error editing pin:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit pin" },
      { status: 500 }
    );
  }
}
