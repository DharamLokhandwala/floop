import { randomUUID } from "crypto";
import { addUserPin as addPinToDb } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Pin } from "@/types/audit";

function normalizePath(pathname: string, search = "", hash = ""): string {
  const p = `${pathname}${search}${hash}`;
  return p === "" || p === "/" ? "/" : p.replace(/\/$/, "") || "/";
}

function normalizePinPageUrl(pageUrl: unknown, auditUrl: string): string {
  const origin = new URL(auditUrl).origin;

  // Only unwrap ?path= when the URL is exactly the proxy view route.
  const isProxyViewUrl = (pathname: string) =>
    /\/audit\/[^/]+\/view\/?$/i.test(pathname);

  const extractPath = (u: URL): string => {
    if (isProxyViewUrl(u.pathname)) {
      const p = u.searchParams.get("path");
      if (p) {
        try {
          const inner = new URL(p, "http://_");
          return normalizePath(inner.pathname, inner.search, inner.hash);
        } catch { return "/"; }
      }
      return "/";
    }
    return normalizePath(u.pathname, u.search, u.hash);
  };

  if (typeof pageUrl !== "string" || !pageUrl.trim()) {
    return `${origin}/`;
  }

  try {
    const path = extractPath(new URL(pageUrl));
    return new URL(path, origin).toString();
  } catch { /* fall through */ }
  try {
    const path = extractPath(new URL(pageUrl, origin));
    return new URL(path, origin).toString();
  } catch { /* fall through */ }
  return `${origin}/`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await prisma.$queryRaw<[{ mode: string | null; url: string | null }]>`
    SELECT mode, url FROM Audit WHERE id = ${id}
  `;
  const auditUrl = rows[0]?.url;
  if (!auditUrl) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  const allowAnonymous = rows[0]?.mode === "request_feedback";
  const user = await getCurrentUser();
  if (!allowAnonymous && !user) {
    return NextResponse.json({ error: "Sign in to add a comment" }, { status: 401 });
  }
  try {
    const body = await request.json();

    const pin: Pin = {
      id: randomUUID(),
      x: body.x,
      y: body.y,
      category: body.category ?? "Feedback",
      feedback: body.feedback,
      pageUrl: normalizePinPageUrl(body.pageUrl, auditUrl),
      selector: body.selector,
      viewportWidth: body.viewportWidth,
      viewportHeight: body.viewportHeight,
      scrollX: body.scrollX,
      scrollY: body.scrollY,
      docX: body.docX,
      docY: body.docY,
      ...(body.audioUrl ? { audioUrl: body.audioUrl } : {}),
      ...(user ? { authorId: user.id, authorName: user.name || user.email || undefined } : {}),
    };
    if (process.env.NODE_ENV !== "production") {
      console.info("[pins] add-pin mapping", {
        incomingPageUrl: body.pageUrl,
        normalizedPageUrl: pin.pageUrl,
      });
    }

    if (
      typeof pin.x !== "number" ||
      typeof pin.y !== "number" ||
      !pin.feedback
    ) {
      return NextResponse.json(
        { error: "Invalid pin data: x, y, and feedback required" },
        { status: 400 }
      );
    }

    // Optional: capture screenshot for this comment (Workflow-style). Commented out — slows submit and is not core flow.
    // if (pin.pageUrl && typeof pin.viewportWidth === "number" && typeof pin.viewportHeight === "number") {
    //   try {
    //     const buffer = await captureViewportScreenshot(pin.pageUrl, {
    //       width: Math.min(pin.viewportWidth, 1920),
    //       height: Math.min(pin.viewportHeight, 1080),
    //     });
    //     pin.screenshotUrl = await uploadScreenshotToBlob(buffer);
    //   } catch (err) {
    //     console.error("Comment screenshot capture failed:", err);
    //   }
    // }

    await addPinToDb(id, pin);
    revalidatePath(`/audit/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding pin:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add pin",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
