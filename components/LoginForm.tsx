"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await signIn("email", {
        email: email.trim(),
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (res?.error) {
        setError(res.error);
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-gray-500 dark:border-border bg-muted/30 p-4 text-center text-sm">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground mt-1">
          We sent a sign-in link to <strong>{email}</strong>. Click the link to continue.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
        />
      </div>
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Sending link…" : "Sign in with email"}
      </Button>
    </form>
  );
}
