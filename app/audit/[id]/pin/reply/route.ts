import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  appendPinReply,
  canViewAudit,
  isAuditPinConflictError,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { validate as isUuid } from "uuid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to reply" }, { status: 401 });
  }

  const allowed = await canViewAudit(auditId, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { pinId?: string; replyId?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pinId = typeof body.pinId === "string" ? body.pinId.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!pinId) {
    return NextResponse.json({ error: "pinId required" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Reply text required" }, { status: 400 });
  }
  const requestedReplyId =
    typeof body.replyId === "string" ? body.replyId.trim() : "";
  if (requestedReplyId && !isUuid(requestedReplyId)) {
    return NextResponse.json({ error: "Invalid reply ID" }, { status: 400 });
  }
  const replyId = requestedReplyId || randomUUID();

  try {
    await appendPinReply(auditId, pinId, {
      id: replyId,
      userId: user.id,
      body: text,
      createdAt: new Date().toISOString(),
      authorName: user.name || user.email || null,
    });
    revalidatePath(`/audit/${auditId}`);
    return NextResponse.json({ success: true, replyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add reply";
    if (msg === "Pin not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (isAuditPinConflictError(err)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("[pin/reply]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
