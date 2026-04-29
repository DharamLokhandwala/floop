"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "password" | "magic";

type LoginFormProps = { callbackUrl?: string; variant?: "default" | "resend"; defaultMode?: Mode; sharedByName?: string | null };

export function LoginForm({ callbackUrl = "/dashboard", variant = "default", defaultMode = "password", sharedByName }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [isEditMode, setIsEditMode] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromSharedAudit = !!sharedByName && callbackUrl?.startsWith("/audit/");
  const isEmailSent = !isEditMode && (variant === "resend" || (mode === "magic" && status === "success"));

  const getHeading = () => {
    if (mode === "magic") return "Sign in with a link";
    return "Sign in";
  };

  const getSubheading = () => {
    if (fromSharedAudit) return `${sharedByName} has shared feedback with you. Sign in below to view it.`;
    if (mode === "magic") return "Enter your email and we'll send you a secure sign-in link.";
    return "Sign in with your email and password, or request a sign-in link.";
  };

  const handleEditEmail = () => {
    setIsEditMode(true);
    setStatus("idle");
    setMode("magic");
    setError(null);
  };

  const handleResendLink = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      await signIn("email", {
        email: email.trim().toLowerCase(),
        callbackUrl: callbackUrl || "/dashboard",
        redirect: false,
      });
      // Optionally reset status or show toast here
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl bg-[#7B8CF6] rounded-[2rem] flex flex-col md:flex-row shadow-2xl overflow-hidden md:min-h-[600px]">
      {/* Left Side: Form Container */}
      <div className="w-full md:w-1/2 bg-background m-3 rounded-[1.5rem] p-8 md:p-12 flex flex-col shrink-0">
        <div className="max-w-sm w-full mx-auto flex flex-col h-full">
          <AnimatePresence mode="wait">
            {isEmailSent ? (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full w-full"
              >
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-10 w-full">
                  <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Check your email</h1>
                    <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[280px] mx-auto">
                      We&apos;ve sent a sign-in link to <br />
                      <span className="inline-flex items-center justify-center gap-2 mt-1">
                        <strong className="text-foreground font-semibold">{email || "your email"}</strong>
                        <button
                          type="button"
                          onClick={handleEditEmail}
                          className="text-muted-foreground hover:text-primary transition-colors p-1 -m-1"
                          aria-label="Edit email"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground text-[13px]">Can&apos;t find the email?</p>
                    <p className="text-muted-foreground text-[13px]">Check your spam or junk folder.</p>
                  </div>

                  <div className="space-y-4 w-full max-w-[280px] pt-2">
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl font-medium border-gray-200 hover:bg-gray-50 shadow-sm"
                      onClick={handleResendLink}
                      disabled={resendLoading || !email}
                    >
                      {resendLoading ? "Sending..." : "Resend link"}
                    </Button>
                  </div>
                </div>

                <div className="mt-auto pt-8 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode("password"); setIsEditMode(true); }}
                    className="text-[14px] font-medium transition-colors hover:opacity-80"
                    style={{ color: "var(--color-floop-blue)" }}
                  >
                    Sign in with password instead
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full w-full"
              >
                <div className="flex-1 flex flex-col justify-center w-full">
                  <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className="space-y-2">
                      <h1 className="text-3xl font-bold tracking-tight text-foreground">{getHeading()}</h1>
                      <p className="text-muted-foreground text-[15px] max-w-[280px] mx-auto leading-relaxed">{getSubheading()}</p>
                    </div>
                  </div>
                  <LoginFormInner callbackUrl={callbackUrl} variant={variant} mode={mode} setMode={setMode} email={email} setEmail={setEmail} status={status} setStatus={setStatus} setIsEditMode={setIsEditMode} error={error} setError={setError} />
                </div>

                {variant !== "resend" && (
                  <div className="mt-auto pt-8 text-center w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === "password" ? "magic" : "password");
                        setError(null);
                        setStatus("idle");
                      }}
                      className="text-[14px] font-medium transition-colors hover:opacity-80"
                      style={{ color: "var(--color-floop-blue)" }}
                    >
                      {mode === "password" ? "First time? Send me a sign-in link" : "Sign in with password instead"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Side: Container */}
      <div className="hidden md:flex w-full md:w-1/2 items-center justify-center p-12">
        <AnimatePresence mode="wait">
          {isEmailSent ? (
            <motion.div
              key="email-icon"
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -15 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className="flex items-center justify-center w-full h-full"
            >
              <Image
                src="/email-notification.svg"
                alt="Email Sent"
                width={560}
                height={560}
                className="object-contain"
              />
            </motion.div>
          ) : (
            <motion.div
              key="testimonials"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-[420px] mx-auto"
            >
              {/* Bottom Card */}
              <div className="absolute top-6 bottom-[-24px] w-[90%] left-[5%] bg-white/5 rounded-3xl border border-white/5"></div>
              {/* Middle Card */}
              <div className="absolute top-3 bottom-[-12px] w-[95%] left-[2.5%] bg-white/10 rounded-3xl border border-white/10"></div>
              {/* Top Card */}
              <div
                className="relative w-full backdrop-blur-lg rounded-3xl p-8 md:p-10 flex flex-col border border-white/20 shadow-2xl z-10 min-h-[340px]"
                style={{ background: 'linear-gradient(135deg, #CCD8FF 0%, #A5B7F6 100%)' }}
              >
                <Image
                  src="/floop-thin.png"
                  alt="floop"
                  width={56}
                  height={56}
                  className="brightness-0 invert opacity-90 object-contain -ml-1"
                />
                <div className="space-y-6 mt-10">
                  <p className="font-serif text-[28px] md:text-[36px] tracking-tight text-white leading-snug">
                    Giving feedback with floop has made my life easier as a mentor
                  </p>
                  <p className="text-white/80 text-sm font-medium tracking-wide">Beta tester</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LoginFormInner({
  callbackUrl, variant, mode, setMode, email, setEmail, status, setStatus, setIsEditMode, error, setError
}: LoginFormProps & {
  mode: Mode; setMode: (mode: Mode) => void; email: string; setEmail: (email: string) => void; status: any; setStatus: any; setIsEditMode: (v: boolean) => void; error: string | null; setError: (err: string | null) => void;
}) {
  const [password, setPassword] = useState("");

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
      setIsEditMode(false);
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  if (mode === "password" && variant !== "resend") {
    return (
      <div className="space-y-6 w-full">
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
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
          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <form onSubmit={handleMagicSubmit} className="space-y-6">
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
        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? (variant === "resend" ? "Sending…" : "Sending link…") : variant === "resend" ? "Resend link" : "Send sign-in link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
