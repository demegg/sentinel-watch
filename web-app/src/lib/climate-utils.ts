import { WMO_WEATHER } from "@/lib/data";

export type ClimatePoint = {
  lat: number;
  lng: number;
  temp: number;
  wind: number;
  windDir: number;
  weatherCode: number;
  condition: string;
};

export function tempColor(t: number) {
  if (t <= 0) return "#3b82f6";
  if (t <= 10) return "#22d3ee";
  if (t <= 20) return "#4ade80";
  if (t <= 28) return "#facc15";
  if (t <= 35) return "#f97316";
  return "#ef4444";
}

export function windColor(w: number) {
  if (w < 10) return "#4ade80";
  if (w < 25) return "#facc15";
  if (w < 40) return "#f97316";
  return "#ef4444";
}

export function windDirLabel(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function climateZone(temp: number) {
  if (temp <= 0) return "Polar / freezing";
  if (temp <= 10) return "Cold temperate";
  if (temp <= 20) return "Mild temperate";
  if (temp <= 28) return "Warm subtropical";
  if (temp <= 35) return "Hot tropical";
  return "Extreme heat";
}

export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function weatherCondition(code: number) {
  return WMO_WEATHER[code] ?? `Weather code ${code}`;
}
