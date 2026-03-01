"use server";

import { redirect } from "next/navigation";

export type AuthState = { error?: string; success?: string };

export async function signup(
  _prev: AuthState,
  _formData: FormData
): Promise<AuthState> {
  return {
    error:
      "This app uses email sign-in. Please use the login page to sign in with your email.",
  };
}

export async function logout() {
  redirect("/api/auth/signout?callbackUrl=/login");
}
