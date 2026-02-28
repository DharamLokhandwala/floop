"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { Pin, PinCategory } from "@/types/audit";

const VALID_CATEGORIES: PinCategory[] = ["SEO", "Visual Design", "CRO"];

function isValidCategory(s: string): s is PinCategory {
  return VALID_CATEGORIES.includes(s as PinCategory);
}

function validatePin(raw: unknown): Pin | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const x = typeof obj.x === "number" ? obj.x : Number(obj.x);
  const y = typeof obj.y === "number" ? obj.y : Number(obj.y);
  const category = typeof obj.category === "string" ? obj.category : "";
  const feedback = typeof obj.feedback === "string" ? obj.feedback : "";
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 100 ||
    y < 0 ||
    y > 100 ||
    !isValidCategory(category) ||
    !feedback.trim()
  ) {
    return null;
  }
  return { x, y, category, feedback };
}

const SYSTEM_PROMPT = `You are an expert UX/SEO/CRO auditor. Analyze the provided website screenshot and return a JSON array of "pins" - specific feedback points overlaid on the image.

For each pin, provide:
- x: number (0-100, horizontal position as percentage from left)
- y: number (0-100, vertical position as percentage from top)
- category: "SEO" | "Visual Design" | "CRO"
- feedback: string (concise critique and suggested fix)

Rules:
- Return ONLY a valid JSON array, no markdown or extra text.
- Limit to 10-20 pins. Prioritize high-impact issues.
- Avoid overlapping pins; spread them across the page.
- Be specific and actionable in feedback.
- Use percentages for x,y so the overlay works on any screen size.`;

export async function analyzeScreenshot({
  screenshotUrl,
  goal,
}: {
  screenshotUrl: string;
  goal: string;
}): Promise<Pin[]> {
  if (process.env.MOCK_ANALYSIS === "true") {
    return getMockPins();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const userContent = [
    {
      type: "image" as const,
      source: {
        type: "url" as const,
        url: screenshotUrl,
      },
    },
    {
      type: "text" as const,
      text: `User Goal: ${goal}\n\nAnalyze this screenshot and return a JSON array of pins.`,
    },
  ];

  // Try different Claude models in order of preference
  const modelsToTry = [
    "claude-3-5-sonnet-latest",  // Latest stable version
    "claude-3-5-sonnet-20241022", // Specific snapshot
    "claude-sonnet-4-20250514",   // Newer model if available
    "claude-3-opus-20240229",     // Fallback to Opus
  ];

  let response;
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      response = await client.messages.create({
        model: modelName,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });
      break; // Success, exit loop
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // If it's a 404, try next model
      if (error instanceof Error && error.message.includes("404")) {
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  if (!response) {
    throw new Error(
      `Failed to generate content with any available Claude model.\n\n` +
      `Last error: ${lastError?.message}\n\n` +
      `Please check:\n` +
      `1. Your API key is valid at https://console.anthropic.com/\n` +
      `2. You have access to Claude models\n` +
      `3. Your account has sufficient credits`
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let raw: unknown;
  try {
    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
    raw = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse Claude response as JSON");
  }

  if (!Array.isArray(raw)) {
    throw new Error("Claude response is not a JSON array");
  }

  const pins: Pin[] = [];
  for (const item of raw) {
    const pin = validatePin(item);
    if (pin) pins.push(pin);
  }

  return pins;
}

function getMockPins(): Pin[] {
  return [
    { x: 15, y: 10, category: "SEO", feedback: "Add a clear H1 heading for better SEO." },
    { x: 50, y: 25, category: "Visual Design", feedback: "Increase contrast between text and background for readability." },
    { x: 80, y: 15, category: "CRO", feedback: "Make the CTA button more prominent with a contrasting color." },
    { x: 30, y: 60, category: "SEO", feedback: "Add alt text to images for accessibility and SEO." },
    { x: 70, y: 75, category: "CRO", feedback: "Reduce form fields to improve conversion rate." },
  ];
}
