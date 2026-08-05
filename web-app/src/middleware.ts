import { NextRequest, NextResponse } from "next/server";

/**
 * Security layer: headers, CSP, same-site API gate, in-memory rate limits.
 * Rate-limit Map is per-instance (fine on a single Node/dev box; use an edge KV
 * before multi-region production scale).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const FEEDS_LIMIT = { max: 8, windowMs: 60_000 };
const CLIMATE_LIMIT = { max: 30, windowMs: 60_000 };
const REPORT_LIMIT = { max: 20, windowMs: 60_000 };
const API_LIMIT = { max: 60, windowMs: 60_000 };

const AID_COOKIE = "sw_aid";
const AID_MAX_AGE = 60 * 60 * 24 * 7;

function clientIp(req: NextRequest): string {
  const platform =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (platform) return platform;

  if (process.env.TRUST_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) {
      const parts = fwd
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }

  return "unknown";
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

function maybePrune() {
  if (buckets.size < 2000) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requestHost(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function hostFromUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Block browser cross-site callers from hotlinking our APIs. */
function isCrossSiteBrowserCall(req: NextRequest): boolean {
  const site = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (site === "cross-site") return true;

  const host = requestHost(req);
  if (!host) return false;

  const originHost = hostFromUrl(req.headers.get("origin"));
  if (originHost && originHost !== host) return true;

  // Only enforce Referer when Sec-Fetch-Site says it is a cross-site navigation/fetch
  // (plain curl has neither Origin nor Sec-Fetch-Site).
  return false;
}

function hasAidCookie(req: NextRequest): boolean {
  const v = req.cookies.get(AID_COOKIE)?.value;
  return Boolean(v && v.length >= 16);
}

function attachAidCookie(req: NextRequest, res: NextResponse): void {
  if (hasAidCookie(req)) return;
  const secure =
    process.env.NODE_ENV === "production" ||
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(AID_COOKIE, randomToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: AID_MAX_AGE,
  });
}

function buildCsp(): string {
  const connect = [
    "'self'",
    "https://maps.googleapis.com",
    "https://*.googleapis.com",
    "https://*.gstatic.com",
    "https://*.basemaps.cartocdn.com",
    "https://tilecache.rainviewer.com",
    "https://*.api.radio-browser.info",
    "https://de1.api.radio-browser.info",
    // Next.js / HMR in local beta
    "ws:",
    "wss:",
  ].join(" ");

  const frames = [
    "'self'",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://www.dailymotion.com",
    "https://*.dailymotion.com",
    "https://www.google.com",
    "https://maps.google.com",
    "https://earth.google.com",
  ].join(" ");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
    // Map tiles + webcam thumbs come from many CDNs
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
    "media-src 'self' blob: https:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    `frame-src ${frames}`,
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

function securityHeaders(res: NextResponse, opts?: { noStore?: boolean }): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
  );
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("Content-Security-Policy", buildCsp());
  if (opts?.noStore) {
    res.headers.set("Cache-Control", "no-store, max-age=0");
  }
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return res;
}

function apiLimitFor(pathname: string): { max: number; windowMs: number; key: string } {
  if (pathname.startsWith("/api/feeds")) return { ...FEEDS_LIMIT, key: "feeds" };
  if (pathname.startsWith("/api/climate")) return { ...CLIMATE_LIMIT, key: "climate" };
  if (
    pathname.startsWith("/api/storm-report") ||
    pathname.startsWith("/api/conflict-report") ||
    pathname.startsWith("/api/hazards")
  ) {
    return { ...REPORT_LIMIT, key: "report" };
  }
  return { ...API_LIMIT, key: "api" };
}

export function middleware(req: NextRequest) {
  maybePrune();
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // All public route handlers are GET-only.
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      const res = NextResponse.json({ error: "Method not allowed" }, { status: 405 });
      res.headers.set("Allow", "GET, HEAD");
      return securityHeaders(res, { noStore: true });
    }

    if (isCrossSiteBrowserCall(req)) {
      const res = NextResponse.json(
        { error: "Cross-origin API access is not allowed." },
        { status: 403 }
      );
      return securityHeaders(res, { noStore: true });
    }

    // Require a same-site HttpOnly browse cookie for costly upstream proxies.
    const expensive =
      pathname.startsWith("/api/feeds") ||
      pathname.startsWith("/api/climate") ||
      pathname.startsWith("/api/planes") ||
      pathname.startsWith("/api/news") ||
      pathname.startsWith("/api/geocode");

    if (expensive && !hasAidCookie(req)) {
      const res = NextResponse.json(
        { error: "Open SentinelWatch in the browser first, then retry." },
        { status: 403 }
      );
      return securityHeaders(res, { noStore: true });
    }

    const ip = clientIp(req);
    const limit = apiLimitFor(pathname);
    const bucketKey = `${ip}:${limit.key}`;

    if (!takeToken(bucketKey, limit.max, limit.windowMs)) {
      const res = NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429 }
      );
      res.headers.set("Retry-After", "60");
      return securityHeaders(res, { noStore: true });
    }

    const res = securityHeaders(NextResponse.next(), { noStore: true });
    // Soft-set cookie on API too so first paint races recover
    attachAidCookie(req, res);
    return res;
  }

  const noStore =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/app");

  const res = securityHeaders(NextResponse.next(), { noStore });
  attachAidCookie(req, res);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
