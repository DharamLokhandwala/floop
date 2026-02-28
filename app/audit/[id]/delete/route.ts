import { deleteAudit } from "@/lib/audits";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteAudit(id);
    revalidatePath("/dashboard");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete audit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
