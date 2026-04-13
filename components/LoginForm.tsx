"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "password" | "magic";

type LoginFormProps = { callbackUrl?: string; variant?: "default" | "resend"; defaultMode?: Mode };

export function LoginForm({ callbackUrl = "/dashboard", variant = "default", defaultMode = "password" }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        callbackUrl: callbackUrl || "/dashboard",
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setStatus("error");
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      setError("Something went wrong.");
      setStatus("error");
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  async function handleMagicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await signIn("email", {
        email: email.trim().toLowerCase(),
        callbackUrl: callbackUrl || "/dashboard",
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

  if (mode === "magic" && status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-gray-500 dark:border-border bg-muted/30 p-4 text-center text-sm">
          <p className="font-medium">Check your email</p>
          <p className="text-muted-foreground mt-1">
            We sent a sign-in link to <strong>{email}</strong>. Click the link to continue.
          </p>
          <p className="text-muted-foreground mt-2">Can&apos;t find it? Check your <strong>spam or junk folder</strong>.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={resendLoading}
          onClick={async () => {
            setResendLoading(true);
            setError(null);
            try {
              const res = await signIn("email", {
                email: email.trim().toLowerCase(),
                callbackUrl: callbackUrl || "/dashboard",
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
            } finally {
              setResendLoading(false);
            }
          }}
        >
          {resendLoading ? "Sending…" : "Resend link"}
        </Button>
        <button
          type="button"
          onClick={() => { setMode("password"); setStatus("idle"); setError(null); }}
          className="text-sm text-primary hover:underline w-full text-center"
        >
          Sign in with password instead
        </button>
      </div>
    );
  }

  if (mode === "password" && variant !== "resend") {
    return (
      <div className="space-y-4">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => { setMode("magic"); setError(null); setStatus("idle"); }}
          className="text-sm w-full text-center hover:opacity-80"
          style={{ color: "var(--color-floop-blue)" }}
        >
          First time? Send me a sign-in link
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="magic-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="magic-email"
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
          {status === "loading" ? (variant === "resend" ? "Sending…" : "Sending link…") : variant === "resend" ? "Resend link" : "Send sign-in link"}
        </Button>
      </form>
      {variant !== "resend" && (
        <button
          type="button"
          onClick={() => { setMode("password"); setError(null); setStatus("idle"); }}
          className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          Sign in with password instead
        </button>
      )}
    </div>
  );
}
