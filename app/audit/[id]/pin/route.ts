import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deletePinById, getAuditById } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";

type AuditRow = { createdById?: string | null };

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to delete a comment" }, { status: 401 });
  }

  const pinId = request.nextUrl.searchParams.get("pinId")?.trim() ?? "";
  if (!pinId) {
    return NextResponse.json({ error: "pinId query parameter required" }, { status: 400 });
  }

  const audit = await getAuditById(auditId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const createdById = (audit as AuditRow).createdById;
  if (!createdById || createdById !== user.id) {
    return NextResponse.json({ error: "Only the audit owner can delete comments" }, { status: 403 });
  }

  try {
    await deletePinById(auditId, pinId);
    revalidatePath(`/audit/${auditId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete pin";
    if (msg === "Pin not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[pin DELETE]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
