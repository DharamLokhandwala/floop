import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      /** True when user has no password set (signed up via magic link). */
      needsPasswordSetup?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    needsPasswordSetup?: boolean;
  }
}
