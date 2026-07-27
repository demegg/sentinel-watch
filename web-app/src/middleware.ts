import { NextRequest, NextResponse } from "next/server";

/**
 * Beta security layer: HTTP security headers + in-memory API rate limits.
 * Single-process only — replace with Redis/edge KV before multi-instance prod.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const FEEDS_LIMIT = { max: 12, windowMs: 60_000 };
const CLIMATE_LIMIT = { max: 40, windowMs: 60_000 };
const API_LIMIT = { max: 90, windowMs: 60_000 };

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function takeToken(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

/** Periodic prune so the Map does not grow forever in long-lived beta servers. */
function maybePrune() {
  if (buckets.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
  );
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // Beta CSP: allow live embeds (YouTube, maps, cams) while blocking plugins / framing by others.
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
      "media-src 'self' blob: https: http:",
      "connect-src 'self' https: http: ws: wss:",
      "worker-src 'self' blob:",
      "frame-src 'self' https: http:",
    ].join("; ")
  );
  // HSTS only meaningful behind HTTPS; harmless on HTTP for beta LAN.
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return res;
}

export function middleware(req: NextRequest) {
  maybePrune();
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const ip = clientIp(req);
    let limit = API_LIMIT;
    let bucketKey = `${ip}:api`;
    if (pathname.startsWith("/api/feeds")) {
      limit = FEEDS_LIMIT;
      bucketKey = `${ip}:feeds`;
    } else if (pathname.startsWith("/api/climate")) {
      limit = CLIMATE_LIMIT;
      bucketKey = `${ip}:climate`;
    }

    if (!takeToken(bucketKey, limit.max, limit.windowMs)) {
      const res = NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429 }
      );
      res.headers.set("Retry-After", "60");
      return securityHeaders(res);
    }
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Apply to pages + APIs; skip Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
