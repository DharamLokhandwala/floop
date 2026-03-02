import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "./db";
import { verifyPassword } from "./auth";

// NextAuth uses NEXTAUTH_URL to build magic-link URLs. In production (e.g. Vercel),
// set NEXTAUTH_URL to your canonical URL (e.g. https://floop.design) so links don't
// point at a deployment URL and cause redirect loops.
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
// Must be a full email @ your Resend-verified domain, e.g. "login@floop.design" or "Floop <login@floop.design>"
const fromEmail = process.env.RESEND_FROM ?? "onboarding@resend.dev";

export const authOptions: NextAuthOptions = {
  ...({ trustHost: true } as Partial<NextAuthOptions>),
  secret: nextAuthSecret,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(credentials.password as string, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    }),
    EmailProvider({
      server: {},
      from: fromEmail,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        if (!process.env.RESEND_API_KEY) {
          console.error("RESEND_API_KEY is not set");
          throw new Error("Email is not configured. Please set RESEND_API_KEY.");
        }
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Sign in to your account",
          html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
        });
        if (error) {
          console.error("Resend send failed:", error);
          throw new Error(
            error.message ?? "Failed to send sign-in email. Try again later."
          );
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
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { passwordHash: true },
        });
        token.needsPasswordSetup = !dbUser?.passwordHash;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.needsPasswordSetup = token.needsPasswordSetup as boolean | undefined;
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
