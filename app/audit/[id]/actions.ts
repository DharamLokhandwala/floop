"use server";

import {
  addUserPin as addPinToDb,
  setShareVisibility,
  shareAuditWithEmail,
  setReviewerName as setReviewerNameInDb,
  updateOwnerLastSeenForAudit,
} from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import type { Pin } from "@/types/audit";
import { revalidatePath } from "next/cache";

export async function setAuditShareVisibility(
  auditId: string,
  visibility: "public" | "private"
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Sign in to change share settings" };
  try {
    await setShareVisibility(auditId, visibility, user.id);
    revalidatePath(`/audit/${auditId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update",
    };
  }
}

export async function shareAuditWithUserEmail(
  auditId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Sign in to share" };
  try {
    await shareAuditWithEmail(auditId, email.trim(), user.id);
    revalidatePath(`/audit/${auditId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to share",
    };
  }
}

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

export async function setReviewerName(
  auditId: string,
  reviewerName: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Sign in to set reviewer name" };
  try {
    await setReviewerNameInDb(auditId, user.id, reviewerName);
    revalidatePath(`/audit/${auditId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save reviewer name",
    };
  }
}

export async function markOwnerCommentsAsSeen(
  auditId: string,
  userPinsCount: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Sign in to update comment status" };
  try {
    await updateOwnerLastSeenForAudit(auditId, user.id, userPinsCount);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update comment status",
    };
  }
}
