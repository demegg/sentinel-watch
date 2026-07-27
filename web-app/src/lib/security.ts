/** Shared security helpers for Sentinel Watch Beta. */

export const MAX_EVENT_RADIUS_KM = 3000;
export const MAX_FEED_RADIUS_KM = 100;
export const MAX_QUERY_LEN = 120;

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

export function clampRadiusKm(raw: number, fallback: number, max: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.round(raw)));
}

export function sanitizeQuery(q: string | null | undefined, max = MAX_QUERY_LEN): string {
  if (!q) return "";
  return q.trim().slice(0, max).replace(/[\u0000-\u001f\u007f]/g, "");
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

/** YouTube video id only (used as streamUrl for youtube kind). */
export function isSafeYoutubeId(id: string): boolean {
  return /^[\w-]{6,20}$/.test(id);
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
