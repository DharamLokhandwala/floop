"use server";

import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium-min";
import { put } from "@vercel/blob";
import { v4 } from "uuid";
import {
  resolvePublicHttpUrl,
  ssrfSafeFetch,
  SsrfBlockedError,
} from "@/lib/ssrf";

const NAVIGATION_TIMEOUT_MS = 45000;
const NETWORK_IDLE_TIMEOUT_MS = 8000;
const PAGE_SETTLE_MS = 2500;
const REQUEST_TIMEOUT_MS = 45000;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const isVercel = typeof process.env.VERCEL === "string";

type Viewport = { width: number; height: number };

/**
 * Captures a full-page screenshot of the given URL using Playwright.
 * Runs in Node.js runtime (not Edge) for Playwright compatibility.
 *
 * When ignoreHTTPSErrors is true, Playwright will proceed even if the
 * target website's TLS/SSL certificate is invalid/expired.
 */
export async function captureScreenshot(
  url: string,
  ignoreHTTPSErrors = false
): Promise<Buffer> {
  return captureScreenshotWithViewport(
    url,
    { width: 1920, height: 1080 },
    true,
    ignoreHTTPSErrors
  );
}

/**
 * Captures a viewport-only (hero) screenshot. Use for thumbnails e.g. request-feedback links.
 */
export async function captureHeroScreenshot(
  url: string,
  ignoreHTTPSErrors = false
): Promise<Buffer> {
  return captureScreenshotWithViewport(
    url,
    { width: 1920, height: 1080 },
    false,
    ignoreHTTPSErrors
  );
}

/**
 * Captures a screenshot of the given URL (viewport or full page).
 * Used for comment screenshots so we store what the user saw.
 *
 * When ignoreHTTPSErrors is true, Playwright will proceed even if the
 * target website's TLS/SSL certificate is invalid/expired.
 */
export async function captureViewportScreenshot(
  url: string,
  viewport: Viewport,
  ignoreHTTPSErrors = false
): Promise<Buffer> {
  return captureScreenshotWithViewport(url, viewport, false, ignoreHTTPSErrors);
}

async function captureScreenshotWithViewport(
  url: string,
  viewport: Viewport,
  fullPage: boolean,
  ignoreHTTPSErrors: boolean,
  attempt = 1
): Promise<Buffer> {
  const MAX_ATTEMPTS = 3;

  // Fail before launching Chromium if the requested top-level URL itself is
  // not public. Every subsequent browser request is checked again below.
  await resolvePublicHttpUrl(url);

  const launchOptions: Parameters<typeof playwrightChromium.launch>[0] = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  };

  if (isVercel) {
    chromium.setGraphicsMode = false; // recommended for serverless (faster cold start)
    // chromium-min has no bundled binary; pass pack URL so it downloads to /tmp at runtime
    const chromiumPackUrl =
      process.env.CHROMIUM_PACK_URL ??
      "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";
    launchOptions.executablePath = await chromium.executablePath(chromiumPackUrl);
    launchOptions.args = chromium.args;
  }

  const browser = await playwrightChromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
      bypassCSP: true,
      serviceWorkers: "block",
    });

    // Route all page-owned HTTP(S) traffic through the same DNS-pinned client
    // used by the HTML/asset proxy. Returning redirect responses to Chromium
    // (rather than following them here) makes each redirect destination pass
    // through this handler and get independently resolved and validated.
    await context.route("**/*", async (route) => {
      const request = route.request();
      let requestUrl: URL;
      try {
        requestUrl = new URL(request.url());
      } catch {
        await route.abort("blockedbyclient");
        return;
      }

      if (requestUrl.protocol === "data:" || requestUrl.protocol === "blob:") {
        await route.continue();
        return;
      }
      if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
        await route.abort("blockedbyclient");
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await ssrfSafeFetch(requestUrl, {
          body: request.postDataBuffer() ?? undefined,
          headers: request.headers(),
          maxRedirects: 0,
          method: request.method(),
          rejectUnauthorized: !ignoreHTTPSErrors,
          signal: controller.signal,
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, name) => {
          if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
            responseHeaders[name] = value;
          }
        });

        await route.fulfill({
          body: response.body,
          headers: responseHeaders,
          status: response.status,
        });
      } catch (error) {
        if (error instanceof SsrfBlockedError) {
          console.warn("[capture] Blocked non-public page request", {
            origin: requestUrl.origin,
            resourceType: request.resourceType(),
          });
        }
        await route.abort("blockedbyclient").catch(() => {});
      } finally {
        clearTimeout(timeout);
      }
    });

    // BrowserContext HTTP routing does not cover WebSocket handshakes. A
    // screenshot does not need bidirectional sockets, so block them rather
    // than letting page JavaScript use Chromium as a private-network client.
    await context.routeWebSocket("**/*", async (webSocket) => {
      await webSocket.close({
        code: 1008,
        reason: "WebSockets are disabled during capture",
      });
    });

    const page = await context.newPage();

    // Navigate with domcontentloaded first (reliable for all sites), then
    // best-effort wait for networkidle so heavy SPAs finish rendering.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page
      .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS })
      .catch(() => {
        // Sites with persistent connections (analytics, websockets, chat widgets)
        // will never reach networkidle — that's fine, we proceed anyway.
      });

    await new Promise((resolve) => setTimeout(resolve, PAGE_SETTLE_MS));

    const buffer = await page.screenshot({
      type: "png",
      fullPage,
    });

    await context.close();
    return Buffer.from(buffer);
  } catch (err) {
    await browser.close().catch(() => {});

    // Playwright throws this when the browser/page crashes (common with --single-process
    // mode on heavy JS sites like Squarespace). Retry up to MAX_ATTEMPTS times.
    const isBrowserCrash =
      err instanceof Error &&
      /target page.*closed|context.*closed|browser.*closed|crashed/i.test(err.message);

    if (isBrowserCrash && attempt < MAX_ATTEMPTS) {
      return captureScreenshotWithViewport(url, viewport, fullPage, ignoreHTTPSErrors, attempt + 1);
    }

    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Uploads a screenshot buffer to Vercel Blob and returns the public URL.
 * Uses the store website-audit-blob (token from BLOB_READ_WRITE_TOKEN).
 */
export async function uploadScreenshotToBlob(buffer: Buffer): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN environment variable is not set. " +
      "Please add it to your .env file. " +
      "You can get your token from https://vercel.com/dashboard/stores"
    );
  }

  const filename = `audits/${v4()}.png`;
  
  try {
    // Try with public access (for public stores)
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/png",
      token,
    });
    return blob.url;
  } catch (error: unknown) {
    // If public access fails (private store), the error will be thrown
    // User needs to use a public store or handle the error appropriately
    throw error;
  }
}
