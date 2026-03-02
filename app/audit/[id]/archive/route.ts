import { archiveAudit } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to archive" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    await archiveAudit(id, user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/archived");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Archive audit error:", error);
    const msg = error instanceof Error ? error.message : "Failed to archive";
    const status = msg.includes("Only the owner") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
