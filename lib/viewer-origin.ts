const DEVELOPMENT_VIEWER_ORIGIN = "http://127.0.0.1:3000";

function normalizeOrigin(raw: string, variableName: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must use http or https`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${variableName} must contain only an origin (scheme, host, and optional port)`);
  }

  return url.origin;
}

/**
 * Returns the isolated origin used to serve untrusted reviewed-site content.
 * Production deliberately has no same-origin fallback: a missing value must
 * fail closed instead of silently restoring the original vulnerability.
 */
export function getViewerOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_VIEWER_ORIGIN?.trim();
  if (configured) {
    return normalizeOrigin(configured, "NEXT_PUBLIC_VIEWER_ORIGIN");
  }

  if (process.env.NODE_ENV === "development") {
    return DEVELOPMENT_VIEWER_ORIGIN;
  }

  throw new Error(
    "NEXT_PUBLIC_VIEWER_ORIGIN is required outside development and must differ from NEXTAUTH_URL"
  );
}

/** Used by middleware, where an absent production setting should match no host. */
export function getOptionalViewerOrigin(): string | null {
  try {
    return getViewerOrigin();
  } catch {
    return null;
  }
}
