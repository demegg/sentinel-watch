import { NextRequest, NextResponse } from "next/server";
import { takeRateLimit } from "@/lib/rate-limit";

/**
 * Security layer: headers, nonce CSP, same-site API gate, durable rate limits.
 * Rate limits use Upstash Redis REST when configured; otherwise in-memory fallback.
 */

const FEEDS_LIMIT = { max: 8, windowMs: 60_000 };
const CLIMATE_LIMIT = { max: 30, windowMs: 60_000 };
const REPORT_LIMIT = { max: 20, windowMs: 60_000 };
const API_LIMIT = { max: 60, windowMs: 60_000 };

const AID_COOKIE = "sw_aid";
const AID_MAX_AGE = 60 * 60 * 24 * 7;

/** Only trust forwarded client IPs when running behind a known edge proxy. */
function behindTrustedProxy(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.CF_PAGES === "1" ||
    process.env.TRUST_PROXY === "1"
  );
}

function clientIp(req: NextRequest): string {
  if (!behindTrustedProxy()) {
    return "direct";
  }

  const platform =
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim();
  if (platform) return platform;

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts[0];
  }

  return "unknown";
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cryptographically random CSP nonce (base64url, attribute-safe). */
function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa is available in Edge middleware
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function requestHost(req: NextRequest): string {
  const raw = behindTrustedProxy()
    ? req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
    : req.headers.get("host") || "";
  return raw.split(",")[0].trim().toLowerCase();
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
    (behindTrustedProxy() && req.headers.get("x-forwarded-proto") === "https");
  res.cookies.set(AID_COOKIE, randomToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: AID_MAX_AGE,
  });
}

function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const isDev = !isProd;
  // React Refresh needs unsafe-eval in development only.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // React inline style={{}} attributes still need unsafe-inline for styles.
  // Scripts are the XSS payload surface — those use nonces, not unsafe-inline.
  const styleSrc = "'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com";

  const connectParts = [
    "'self'",
    "https://*.basemaps.cartocdn.com",
    "https://tilecache.rainviewer.com",
    "https://*.api.radio-browser.info",
    "https://de1.api.radio-browser.info",
  ];
  if (isDev) connectParts.push("ws:", "wss:");

  const frames = [
    "'self'",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://www.dailymotion.com",
    "https://geo.dailymotion.com",
  ].join(" ");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
    "media-src 'self' blob: https: http:",
    `connect-src ${connectParts.join(" ")}`,
    "worker-src 'self' blob:",
    `frame-src ${frames}`,
  ];
  if (isProd) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function securityHeaders(
  res: NextResponse,
  opts: { noStore?: boolean; nonce: string }
): NextResponse {
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
  res.headers.set("Content-Security-Policy", buildCsp(opts.nonce));
  if (opts.noStore) {
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
    pathname.startsWith("/api/hazards") ||
    pathname.startsWith("/api/events")
  ) {
    return { ...REPORT_LIMIT, key: "report" };
  }
  return { ...API_LIMIT, key: "api" };
}

/** All upstream-proxy routes require a same-site browse cookie. */
function isAidGated(pathname: string): boolean {
  return (
    pathname.startsWith("/api/feeds") ||
    pathname.startsWith("/api/climate") ||
    pathname.startsWith("/api/planes") ||
    pathname.startsWith("/api/news") ||
    pathname.startsWith("/api/geocode") ||
    pathname.startsWith("/api/reverse") ||
    pathname.startsWith("/api/weather") ||
    pathname.startsWith("/api/events") ||
    pathname.startsWith("/api/hazards") ||
    pathname.startsWith("/api/storm-report") ||
    pathname.startsWith("/api/conflict-report") ||
    pathname.startsWith("/api/storms") ||
    pathname.startsWith("/api/fires") ||
    pathname.startsWith("/api/combat") ||
    pathname.startsWith("/api/space") ||
    pathname.startsWith("/api/radar")
  );
}

function nextWithNonce(req: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  // Mitigate request-header CSP/nonce poisoning (see Next GHSA-ffhc-5mcf-pf4q class issues)
  requestHeaders.delete("content-security-policy");
  requestHeaders.delete("content-security-policy-report-only");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const nonce = createNonce();
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      const res = NextResponse.json({ error: "Method not allowed" }, { status: 405 });
      res.headers.set("Allow", "GET, HEAD");
      return securityHeaders(res, { noStore: true, nonce });
    }

    if (isCrossSiteBrowserCall(req)) {
      const res = NextResponse.json(
        { error: "Cross-origin API access is not allowed." },
        { status: 403 }
      );
      return securityHeaders(res, { noStore: true, nonce });
    }

    if (isAidGated(pathname) && !hasAidCookie(req)) {
      const res = NextResponse.json(
        { error: "Open SentinelWatch in the browser first, then retry." },
        { status: 403 }
      );
      return securityHeaders(res, { noStore: true, nonce });
    }

    const ip = clientIp(req);
    const limit = apiLimitFor(pathname);
    const aid = req.cookies.get(AID_COOKIE)?.value?.slice(0, 16) || "noaid";
    const bucketKey = `${limit.key}:${ip}:${aid}`;

    const rl = await takeRateLimit(bucketKey, limit.max, limit.windowMs);
    if (!rl.ok) {
      const res = NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429 }
      );
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      res.headers.set("Retry-After", String(retryAfter));
      res.headers.set("X-RateLimit-Remaining", "0");
      return securityHeaders(res, { noStore: true, nonce });
    }

    const res = securityHeaders(nextWithNonce(req, nonce), { noStore: true, nonce });
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    attachAidCookie(req, res);
    return res;
  }

  const noStore =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/app");

  const res = securityHeaders(nextWithNonce(req, nonce), { noStore, nonce });
  attachAidCookie(req, res);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
