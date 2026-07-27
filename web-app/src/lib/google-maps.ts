const STORAGE_KEY = "sw_google_maps_api_key";

/** Google Cloud API keys are typically 30–45 chars; reject obvious garbage / injection. */
function looksLikeApiKey(key: string): boolean {
  return /^[A-Za-z0-9_\-]{20,80}$/.test(key);
}

export function getGoogleMapsApiKey(): string | null {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (stored && looksLikeApiKey(stored)) return stored;
  }
  const env = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (env && looksLikeApiKey(env)) return env;
  return null;
}

export function setGoogleMapsApiKey(key: string): void {
  const cleaned = key.trim();
  if (typeof window === "undefined") return;
  if (!cleaned) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  if (!looksLikeApiKey(cleaned)) return;
  window.localStorage.setItem(STORAGE_KEY, cleaned);
}

export function clearGoogleMapsApiKey(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function notifyGoogleKeyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sw-google-key"));
  }
}

/** Map zoom (3–21) → camera range in meters for Map3D. */
export function zoomToRange(zoom: number): number {
  const z = Math.min(21, Math.max(3, zoom));
  return Math.max(40, 42_000_000 / Math.pow(2, z - 1));
}

export function tiltForZoom(zoom: number): number {
  if (zoom <= 4) return 0;
  if (zoom < 10) return 25;
  if (zoom < 14) return 45;
  return 62;
}

export function streetViewEmbedUrl(lat: number, lng: number, apiKey?: string | null) {
  if (apiKey && looksLikeApiKey(apiKey)) {
    return `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(apiKey)}&location=${lat},${lng}&heading=210&pitch=0&fov=90`;
  }
  return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
}

export function earthWebUrl(lat: number, lng: number, zoom: number) {
  const range = Math.max(200, zoomToRange(zoom));
  return `https://earth.google.com/web/@${lat},${lng},${range}a,35y,0h,0t,0r`;
}
