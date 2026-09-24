import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { canViewAudit } from "./audits";

const TOKEN_VERSION = 1;
const TOKEN_WINDOW_SECONDS = 60 * 60;
const DEVELOPMENT_SECRET = "dev-secret-min-32-chars-required-for-jwt";

type ViewerAccessPayload = {
  version: typeof TOKEN_VERSION;
  auditId: string;
  userId: string | null;
  expiresAt: number;
};

function getSigningSecret(): string {
  const configured = process.env.NEXTAUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") return DEVELOPMENT_SECRET;
  throw new Error("NEXTAUTH_SECRET is required to sign viewer access tokens");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

/**
 * Issues a short-lived, audit-scoped capability only after applying the same
 * permission policy used by the main audit page. The viewer origin has no app
 * session, so /view and /asset must receive this capability explicitly.
 */
export async function createAuditViewerAccessToken(
  auditId: string,
  userId: string | null
): Promise<string | null> {
  if (!(await canViewAudit(auditId, userId))) return null;

  const now = Math.floor(Date.now() / 1000);
  // Keep the token stable during a clock-hour so router.refresh() does not
  // unnecessarily reload the iframe. Lifetime is between one and two hours.
  const expiresAt =
    (Math.floor(now / TOKEN_WINDOW_SECONDS) + 2) * TOKEN_WINDOW_SECONDS;
  const payload: ViewerAccessPayload = {
    version: TOKEN_VERSION,
    auditId,
    userId,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAuditViewerAccessToken(
  token: string | null,
  expectedAuditId: string
): ViewerAccessPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encodedPayload, suppliedSignature] = parts;
  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<ViewerAccessPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== TOKEN_VERSION ||
      payload.auditId !== expectedAuditId ||
      (payload.userId !== null && typeof payload.userId !== "string") ||
      typeof payload.expiresAt !== "number" ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload as ViewerAccessPayload;
  } catch {
    return null;
  }
}
