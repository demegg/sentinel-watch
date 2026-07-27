export type EventKind =
  | "earthquake"
  | "wildfire"
  | "storm"
  | "volcano"
  | "flood"
  | "drought"
  | "conflict"
  | "blackout"
  | "disaster"
  | "news"
  | "other";

export interface LocationPin {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  type: "city" | "search" | "user";
  timezone?: string;
  countryCode?: string;
}

export interface RegionalEvent {
  id: string;
  kind: EventKind;
  title: string;
  detail: string;
  lat: number;
  lng: number;
  distanceKm: number;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
  source: string;
  url?: string;
}

export type CameraSource = "osm" | "youtube" | "windy" | "dailymotion" | "embed";

export interface PublicCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  exact: boolean;
  source: CameraSource;
  streamUrl: string;
  kind: "youtube" | "image" | "hls" | "page" | "dailymotion";
  distanceKm: number;
  thumbnail?: string;
  /** Stream is confirmed live (not pre-recorded). */
  isLive: boolean;
  liveVerified?: boolean;
}

export interface RadioStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  exact: boolean;
  streamUrl: string;
  homepage?: string;
  favicon?: string;
  bitrate?: number;
  codec?: string;
  tags?: string;
  country?: string;
  distanceKm: number;
  stationuuid: string;
}

export const EVENT_COLORS: Record<EventKind, string> = {
  earthquake: "#ff3355",
  wildfire: "#ff7a1a",
  storm: "#38bdf8",
  volcano: "#f97316",
  flood: "#2563eb",
  drought: "#ca8a04",
  conflict: "#ef4444",
  blackout: "#a855f7",
  disaster: "#f43f5e",
  news: "#fbbf24",
  other: "#94a3b8",
};

export const EVENT_EMOJI: Record<EventKind, string> = {
  earthquake: "🔴",
  wildfire: "🔥",
  storm: "🌀",
  volcano: "🌋",
  flood: "🌊",
  drought: "🌵",
  conflict: "⚔️",
  blackout: "⚡",
  disaster: "🚨",
  news: "📰",
  other: "⚪",
};

export const CITIES: LocationPin[] = [
  { id: "nyc", name: "New York", country: "USA", lat: 40.7128, lng: -74.006, type: "city", timezone: "America/New_York", countryCode: "US" },
  { id: "lon", name: "London", country: "UK", lat: 51.5074, lng: -0.1278, type: "city", timezone: "Europe/London", countryCode: "GB" },
  { id: "tok", name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, type: "city", timezone: "Asia/Tokyo", countryCode: "JP" },
  { id: "ber", name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, type: "city", timezone: "Europe/Berlin", countryCode: "DE" },
  { id: "par", name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, type: "city", timezone: "Europe/Paris", countryCode: "FR" },
  { id: "syd", name: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, type: "city", timezone: "Australia/Sydney", countryCode: "AU" },
  { id: "dxb", name: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, type: "city", timezone: "Asia/Dubai", countryCode: "AE" },
  { id: "sin", name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, type: "city", timezone: "Asia/Singapore", countryCode: "SG" },
  { id: "rio", name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729, type: "city", timezone: "America/Sao_Paulo", countryCode: "BR" },
  { id: "cai", name: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357, type: "city", timezone: "Africa/Cairo", countryCode: "EG" },
  { id: "mos", name: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6173, type: "city", timezone: "Europe/Moscow", countryCode: "RU" },
  { id: "lax", name: "Los Angeles", country: "USA", lat: 34.0522, lng: -118.2437, type: "city", timezone: "America/Los_Angeles", countryCode: "US" },
  { id: "mum", name: "Mumbai", country: "India", lat: 19.076, lng: 72.8777, type: "city", timezone: "Asia/Kolkata", countryCode: "IN" },
  { id: "kie", name: "Kyiv", country: "Ukraine", lat: 50.4501, lng: 30.5234, type: "city", timezone: "Europe/Kiev", countryCode: "UA" },
  { id: "tbi", name: "Tbilisi", country: "Georgia", lat: 41.7151, lng: 44.8271, type: "city", timezone: "Asia/Tbilisi", countryCode: "GE" },
];

export const WMO_WEATHER: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Rain", 65: "Heavy rain", 71: "Slight snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent rain",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail",
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function severityColor(s: RegionalEvent["severity"]) {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f97316";
  if (s === "medium") return "#facc15";
  return "#4ade80";
}
