"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export type OnboardingState = { error?: string };

const MIN_PASSWORD_LENGTH = 12;

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.name) redirect("/dashboard");

  const name = (formData.get("name") as string)?.trim() ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";

  if (!name) return { error: "Name is required." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { name, passwordHash },
  });

  redirect("/dashboard");
}
