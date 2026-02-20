import { NextRequest } from "next/server";

export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw || "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
