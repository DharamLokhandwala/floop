import { getAuditById } from "@/lib/audits";
import { NextRequest, NextResponse } from "next/server";

const MIME_BY_EXT: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".map": "application/json",
};

/**
 * Proxies sub-resources (JS, CSS, fonts, images …) from the audit target
 * origin so the browser never makes cross-origin requests.
 *
 *   GET /audit/[id]/asset/assets/index.js
 *   → fetches https://<audit-origin>/assets/index.js and streams it back.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path } = await context.params;
  const audit = await getAuditById(id);
  if (!audit) {
    return new NextResponse("Audit not found", { status: 404 });
  }

  const auditOrigin = new URL(audit.url).origin;
  const resourcePath = "/" + path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = auditOrigin + resourcePath + search;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: request.headers.get("accept") ?? "*/*",
        "Accept-Encoding": "identity",
        Referer: auditOrigin + "/",
        "Sec-Ch-Ua":
          '"Chromium";v="124", "Google Chrome";v="124", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const upstreamCT = upstream.headers.get("content-type");
    const ext = resourcePath.match(/(\.\w+)(?:\?|$)/)?.[1]?.toLowerCase() ?? "";
    const contentType = upstreamCT || MIME_BY_EXT[ext] || "application/octet-stream";

    const isCSS = contentType.includes("text/css");
    if (isCSS) {
      const body = await upstream.arrayBuffer();
      const appOrigin = request.nextUrl.origin;
      const assetBase = `${appOrigin}/audit/${id}/asset`;
      let css = new TextDecoder().decode(body);
      css = rewriteCssUrls(css, auditOrigin, assetBase);
      return new NextResponse(css, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Stream non-HTML (JS, images, fonts, etc.) directly without buffering
    const streamHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    };
    if (upstream.headers.get("content-length")) {
      streamHeaders["Content-Length"] = upstream.headers.get("content-length")!;
    }
    return new NextResponse(upstream.body ?? undefined, {
      headers: streamHeaders,
    });
  } catch (err) {
    console.error("Asset proxy error:", targetUrl, err);
    return new NextResponse(null, { status: 502 });
  }
}

/**
 * Rewrites url() inside CSS so resources load through the asset proxy:
 * - Same-origin: url(https://target/origin/path) → url(assetBase/path)
 * - Absolute path: url(/path) → url(assetBase/path)
 */
function rewriteCssUrls(css: string, targetOrigin: string, assetBase: string): string {
  const escaped = targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = css.replace(
    new RegExp(`url\\(\\s*(['"]?)${escaped}(/[^)'"\\s]*)\\1\\s*\\)`, "gi"),
    (_match, quote: string, path: string) => `url(${quote}${assetBase}${path}${quote})`
  );
  out = out.replace(
    /url\s*\(\s*(['"]?)(\/[^)'"\s]*)\1\s*\)/gi,
    (_match, quote: string, path: string) => `url(${quote}${assetBase}${path}${quote})`
  );
  return out;
}
