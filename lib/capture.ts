"use server";

import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { put } from "@vercel/blob";
import { v4 } from "uuid";

const NAVIGATION_TIMEOUT_MS = 45000;
const NETWORK_IDLE_TIMEOUT_MS = 8000;
const PAGE_SETTLE_MS = 2500;

const isVercel = typeof process.env.VERCEL === "string";

type Viewport = { width: number; height: number };

/**
 * Captures a full-page screenshot of the given URL using Playwright.
 * Runs in Node.js runtime (not Edge) for Playwright compatibility.
 */
export async function captureScreenshot(url: string): Promise<Buffer> {
  return captureScreenshotWithViewport(url, { width: 1920, height: 1080 }, true);
}

/**
 * Captures a screenshot of the given URL (viewport or full page).
 * Used for comment screenshots so we store what the user saw.
 */
export async function captureViewportScreenshot(
  url: string,
  viewport: Viewport
): Promise<Buffer> {
  return captureScreenshotWithViewport(url, viewport, false);
}

async function captureScreenshotWithViewport(
  url: string,
  viewport: Viewport,
  fullPage: boolean
): Promise<Buffer> {
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
    launchOptions.executablePath = await chromium.executablePath();
    launchOptions.args = chromium.args;
  }

  const browser = await playwrightChromium.launch(launchOptions);

  try {
    const context = await browser.newContext({
      viewport,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
      bypassCSP: true,
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
  } finally {
    await browser.close();
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
