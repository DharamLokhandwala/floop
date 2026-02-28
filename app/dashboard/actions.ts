"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export type ProfileState = { error?: string; success?: string };
export type NotificationsState = { error?: string; success?: string };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const name = (formData.get("name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim();

  if (!email) {
    return { error: "Email is required" };
  }

  const existing = await prisma.user.findFirst({
    where: { email, id: { not: user.id } },
  });
  if (existing) {
    return { error: "This email is already in use by another account" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email },
  });

  revalidatePath("/dashboard/profile");
  return { success: "Profile updated" };
}

export async function updateNotificationSettings(
  _prev: NotificationsState,
  formData: FormData
): Promise<NotificationsState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const notifyOnAuditComplete = formData.get("notifyOnAuditComplete") === "on";
  const notifyWeeklyDigest = formData.get("notifyWeeklyDigest") === "on";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifyOnAuditComplete,
      notifyWeeklyDigest,
    },
  });

  revalidatePath("/dashboard/settings");
  return { success: "Notification settings updated" };
}

export async function deleteAccount(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  await prisma.user.delete({
    where: { id: user.id },
  });

  redirect("/api/auth/signout?callbackUrl=/login");
}
