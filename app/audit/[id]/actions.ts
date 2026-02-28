"use server";

import { addUserPin as addPinToDb } from "@/lib/audits";
import type { Pin } from "@/types/audit";
import { revalidatePath } from "next/cache";

export async function addUserPin(
  auditId: string,
  pin: Pin
): Promise<{ success: boolean; error?: string }> {
  try {
    await addPinToDb(auditId, pin);
    revalidatePath(`/audit/${auditId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add pin",
    };
  }
}
