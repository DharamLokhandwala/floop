"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export type ProfileState = { error?: string; success?: string };
export type NotificationsState = { error?: string; success?: string };
export type PasswordState = { error?: string; success?: string };

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

const MIN_PASSWORD_LENGTH = 8;

export async function setPassword(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.passwordHash) {
    return { error: "You already have a password set. Use Settings to change it." };
  }

  const password = (formData.get("password") as string)?.trim() ?? "";
  const confirm = (formData.get("confirmPassword") as string)?.trim() ?? "";

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/set-password");
  redirect("/dashboard?password-set=1");
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
