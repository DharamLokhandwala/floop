import { updatePinReply, deletePinReply, getAuditById } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** POST = edit reply, DELETE = delete reply */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const { pinId, replyId, body } = await request.json();
    if (!pinId || !replyId || !body || typeof body !== "string") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const audit = await getAuditById(id);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    // Find the reply to check ownership
    const allPins = [...audit.pins, ...audit.userPins];
    const pin = allPins.find((p) => p.id === pinId);
    if (!pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }
    const reply = pin.replies?.find((r) => r.id === replyId);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Only the reply author or the audit owner can edit
    const isOwner = audit.createdById === user.id;
    const isReplyAuthor = reply.userId === user.id;
    if (!isOwner && !isReplyAuthor) {
      return NextResponse.json({ error: "No permission" }, { status: 403 });
    }

    await updatePinReply(id, pinId, replyId, body.trim());
    revalidatePath(`/audit/${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error editing reply:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const pinId = request.nextUrl.searchParams.get("pinId")?.trim() ?? "";
  const replyId = request.nextUrl.searchParams.get("replyId")?.trim() ?? "";
  if (!pinId || !replyId) {
    return NextResponse.json({ error: "pinId and replyId required" }, { status: 400 });
  }

  try {
    const audit = await getAuditById(id);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const allPins = [...audit.pins, ...audit.userPins];
    const pin = allPins.find((p) => p.id === pinId);
    if (!pin) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }
    const reply = pin.replies?.find((r) => r.id === replyId);
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const isOwner = audit.createdById === user.id;
    const isReplyAuthor = reply.userId === user.id;
    if (!isOwner && !isReplyAuthor) {
      return NextResponse.json({ error: "No permission" }, { status: 403 });
    }

    await deletePinReply(id, pinId, replyId);
    revalidatePath(`/audit/${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
