import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "./db";

// Default for local dev so callbacks/redirects work without setting NEXTAUTH_URL.
if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV === "development") {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

// NextAuth requires a secret for JWT. Use env or a dev-only fallback so the error message is clear.
const nextAuthSecret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "development"
    ? "dev-secret-min-32-chars-required-for-jwt"
    : undefined);
if (!nextAuthSecret && process.env.NODE_ENV === "production") {
  console.error("NEXTAUTH_SECRET must be set in production.");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM ?? "onboarding@resend.dev";

export const authOptions: NextAuthOptions = {
  ...({ trustHost: true } as Partial<NextAuthOptions>),
  secret: nextAuthSecret,
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {},
      from: fromEmail,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        if (!process.env.RESEND_API_KEY) {
          console.error("RESEND_API_KEY is not set");
          return;
        }
        try {
          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Sign in to your account",
            html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
          });
        } catch (err) {
          console.error("Failed to send verification email:", err);
          throw new Error("Failed to send sign-in email");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    createUser: async ({ user }) => {
      // Optional: set createdAt on our User model is already default(now())
      // Prisma adapter creates user with id, email, emailVerified, name, image
      // Our extra fields have defaults in schema
    },
  },
};
