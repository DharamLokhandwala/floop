import type { NextRequest } from "next/server";
import { getViewerOrigin } from "./viewer-origin";

export type ViewerOriginContext = {
  appOrigin: string;
  viewerOrigin: string;
};

function getAppOrigin(): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) {
    throw new Error("NEXTAUTH_URL is required to restrict who may embed the viewer");
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEXTAUTH_URL must be a valid absolute URL");
  }

  return url.origin;
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");

  if (!host) {
    throw new Error("Request Host header is required to enforce viewer-origin isolation");
  }

  return new URL(`${protocol}://${host}`).origin;
}

/**
 * Validates that a proxy request arrived on the isolated viewer origin.
 * Returns null for requests made against the main app origin.
 */
export function getViewerOriginContext(request: NextRequest): ViewerOriginContext | null {
  const viewerOrigin = getViewerOrigin();
  const appOrigin = getAppOrigin();

  if (viewerOrigin === appOrigin) {
    throw new Error(
      "NEXT_PUBLIC_VIEWER_ORIGIN must be different from NEXTAUTH_URL so untrusted content is isolated"
    );
  }

  if (getRequestOrigin(request) !== viewerOrigin) {
    return null;
  }

  return { appOrigin, viewerOrigin };
}
