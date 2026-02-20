import { NextRequest, NextResponse } from "next/server";
import { constantTimeEqual, getClientIp, parsePositiveInt } from "@/lib/security";

type RateLimitBucket = "admin" | "cron";
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = globalThis as typeof globalThis & {
  __edgeRateLimitStore?: Map<string, RateLimitEntry>;
};

const RATE_LIMITS = {
  admin: {
    max: parsePositiveInt(process.env.ADMIN_RATE_LIMIT_MAX, 80),
    windowMs: parsePositiveInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 60_000),
  },
  cron: {
    max: parsePositiveInt(process.env.CRON_RATE_LIMIT_MAX, 20),
    windowMs: parsePositiveInt(process.env.CRON_RATE_LIMIT_WINDOW_MS, 60_000),
  },
} as const;

function getStore() {
  if (!rateLimitStore.__edgeRateLimitStore) {
    rateLimitStore.__edgeRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return rateLimitStore.__edgeRateLimitStore;
}

function cleanupExpiredEntries(now: number) {
  const store = getStore();
  if (store.size < 5000) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

function applyRateLimitHeaders(
  res: NextResponse,
  bucket: RateLimitBucket,
  remaining: number,
  resetAt: number,
) {
  const config = RATE_LIMITS[bucket];
  res.headers.set("X-RateLimit-Limit", String(config.max));
  res.headers.set("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
  res.headers.set("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
}

function checkRateLimit(req: NextRequest, bucket: RateLimitBucket) {
  const now = Date.now();
  cleanupExpiredEntries(now);
  const config = RATE_LIMITS[bucket];
  const key = `${bucket}:${getClientIp(req)}`;
  const store = getStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt,
    };
  }

  if (current.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    allowed: true,
    remaining: config.max - current.count,
    resetAt: current.resetAt,
  };
}

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("Origin-Agent-Cluster", "?1");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  );
  return res;
}

function unauthorizedBasic() {
  const res = NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  res.headers.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  return withSecurityHeaders(res);
}

function parseBasicAuth(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = auth.slice("Basic ".length);
    const decoded = atob(encoded);
    const index = decoded.indexOf(":");
    if (index === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, index),
      password: decoded.slice(index + 1),
    };
  } catch {
    return null;
  }
}

function isAdminAuthorized(req: NextRequest) {
  const expectedUser = process.env.ADMIN_BASIC_USER;
  const expectedPass = process.env.ADMIN_BASIC_PASS;

  if (!expectedUser || !expectedPass) {
    return false;
  }

  const creds = parseBasicAuth(req);
  if (!creds) {
    return false;
  }

  return (
    constantTimeEqual(creds.username, expectedUser) &&
    constantTimeEqual(creds.password, expectedPass)
  );
}

function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  return constantTimeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`);
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin") || path.startsWith("/api/admin");
  const isCronPath = path.startsWith("/api/cron");

  if (isAdminPath) {
    const rate = checkRateLimit(req, "admin");
    if (!rate.allowed) {
      const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil((rate.resetAt - Date.now()) / 1000)));
      applyRateLimitHeaders(res, "admin", rate.remaining, rate.resetAt);
      return withSecurityHeaders(res);
    }

    if (!isAdminAuthorized(req)) {
      const res = unauthorizedBasic();
      applyRateLimitHeaders(res, "admin", rate.remaining, rate.resetAt);
      return res;
    }

    const res = NextResponse.next();
    applyRateLimitHeaders(res, "admin", rate.remaining, rate.resetAt);
    return withSecurityHeaders(res);
  }

  if (isCronPath) {
    const rate = checkRateLimit(req, "cron");
    if (!rate.allowed) {
      const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil((rate.resetAt - Date.now()) / 1000)));
      applyRateLimitHeaders(res, "cron", rate.remaining, rate.resetAt);
      return withSecurityHeaders(res);
    }

    if (!isCronAuthorized(req)) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      applyRateLimitHeaders(res, "cron", rate.remaining, rate.resetAt);
      return withSecurityHeaders(res);
    }

    const res = NextResponse.next();
    applyRateLimitHeaders(res, "cron", rate.remaining, rate.resetAt);
    return withSecurityHeaders(res);
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
