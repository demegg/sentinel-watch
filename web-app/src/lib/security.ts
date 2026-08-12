/** Shared security helpers for Sentinel Watch Beta. */

export const MAX_EVENT_RADIUS_KM = 3000;
export const MAX_FEED_RADIUS_KM = 100;
export const MAX_QUERY_LEN = 120;
export const MAX_GEOCODE_RESULTS = 8;

/** Valid geographic coordinates. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Bounding box for live layers (planes, etc.). */
export function isValidBBox(
  lamin: number,
  lomin: number,
  lamax: number,
  lomax: number
): boolean {
  if (![lamin, lomin, lamax, lomax].every(Number.isFinite)) return false;
  if (lamin < -90 || lamax > 90 || lamin >= lamax) return false;
  if (lomin < -180 || lomax > 180 || lomin >= lomax) return false;
  // Cap span so anonymous OpenSky / heavy fetches stay bounded
  if (lamax - lamin > 40 || lomax - lomin > 60) return false;
  return true;
}

export function clampRadiusKm(raw: number, fallback: number, max: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.round(raw)));
}

export function sanitizeQuery(q: string | null | undefined, max = MAX_QUERY_LEN): string {
  if (!q) return "";
  return q
    .trim()
    .slice(0, max)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[&=?#]/g, "");
}

/** ISO 3166-1 alpha-2 only. */
export function isSafeCountryCode(code: string | null | undefined): code is string {
  return Boolean(code && /^[A-Z]{2}$/.test(code));
}

/**
 * Only allow http(s) absolute URLs. Rejects javascript:, data:, etc.
 * Prefer https for embeds/links; allowHttp for media streams that are still HTTP.
 */
export function safeHttpUrl(
  raw: string | null | undefined,
  opts: { allowHttp?: boolean } = {}
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "https:") return u.href;
    if (opts.allowHttp && u.protocol === "http:") return u.href;
    return null;
  } catch {
    return null;
  }
}

const THUMB_HOST_SUFFIXES = [
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  "windy.com",
  "staticflickr.com",
  "twimg.com",
  "dmcdn.net",
  "dailymotion.com",
  "radio-browser.info",
];

/** HTTPS thumbnails from known media CDNs only. */
export function safeThumbnailUrl(raw: string | null | undefined): string | null {
  const href = safeHttpUrl(raw);
  if (!href) return null;
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (
      THUMB_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`)
      )
    ) {
      return href;
    }
  } catch {
    return null;
  }
  return null;
}

/** YouTube video id only (used as streamUrl for youtube kind). */
export function isSafeYoutubeId(id: string): boolean {
  return /^[\w-]{11}$/.test(id);
}

/**
 * Dailymotion embeds must be real embed hosts + /embed/ path.
 * Never use string.includes("dailymotion.com") for classification.
 */
export function isSafeDailymotionEmbed(raw: string | null | undefined): boolean {
  const href = safeHttpUrl(raw);
  if (!href) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    const allowed =
      host === "www.dailymotion.com" ||
      host === "geo.dailymotion.com" ||
      host === "dailymotion.com";
    return allowed && u.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

/** Host equality helper for stream classification (no substring tricks). */
export function hostnameEquals(raw: string, allowed: string[]): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return allowed.some((a) => host === a || host.endsWith(`.${a}`));
  } catch {
    return false;
  }
}

export function safeClientError(err: unknown, fallback = "Request failed"): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  // Avoid reflecting raw user input or stack internals
  if (msg.length > 160) return fallback;
  if (/not found|invalid|required|unavailable|timeout|failed/i.test(msg)) {
    return msg.replace(/[<>]/g, "");
  }
  return fallback;
}

/** Strip attacker-controlled OG title noise. */
export function sanitizeDisplayTitle(raw: string | null | undefined, max = 80): string {
  if (!raw) return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>`]/g, "")
    .trim()
    .slice(0, max);
}
