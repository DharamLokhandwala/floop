import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalViewerOrigin } from "@/lib/viewer-origin";

const VIEWER_PROXY_PATH = /^\/audit\/[^/]+\/(?:view\/?|asset(?:\/.*)?)$/;

function requestOrigin(request: { headers: Headers; nextUrl: URL }): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  if (!host) return null;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function isViewerRequest(request: { headers: Headers; nextUrl: URL }): boolean {
  const viewerOrigin = getOptionalViewerOrigin();
  return viewerOrigin !== null && requestOrigin(request) === viewerOrigin;
}

export default async function middleware(request: NextRequest) {
  if (isViewerRequest(request)) {
    // The viewer host is intentionally not another entry point to the app.
    // It serves only untrusted proxy documents and their proxied assets, so
    // target-site JavaScript cannot reach auth or application routes there.
    if (!VIEWER_PROXY_PATH.test(request.nextUrl.pathname)) {
      return new NextResponse("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const protectedPath = path === "/onboarding" || path.startsWith("/dashboard");
  if (protectedPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
