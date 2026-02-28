/**
 * Auto-prepends https:// if the input looks like a bare domain (no protocol).
 */
export function normalizeUrl(str: string): string {
  const trimmed = str.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateGoal(goal: string): string | null {
  const trimmed = goal.trim();
  if (trimmed.length < 3) return "Goal must be at least 3 characters";
  if (trimmed.length > 1000) return "Goal must be under 1000 characters";
  return null;
}
