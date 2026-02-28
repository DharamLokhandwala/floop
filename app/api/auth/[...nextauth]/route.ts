import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const handler = NextAuth(authOptions);

function wrap(
  fn: (req: Request, ctx?: unknown) => Promise<Response> | Response
) {
  return async (req: Request, ctx?: unknown) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      console.error("[NextAuth] Error:", err);
      throw err;
    }
  };
}

export const GET = wrap(handler);
export const POST = wrap(handler);
