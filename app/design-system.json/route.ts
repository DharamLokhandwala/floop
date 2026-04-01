import { NextResponse } from "next/server";
import { getDesignSystemSnapshot } from "@/lib/design-system";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const snapshot = await getDesignSystemSnapshot();
  return NextResponse.json(snapshot, { status: 200 });
}
