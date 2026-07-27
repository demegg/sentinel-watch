import { NextRequest, NextResponse } from "next/server";
import { haversineKm, type RadioStation } from "@/lib/data";
import { discoverLiveCameras } from "@/lib/cam-discovery";
import { toEnglishLabel, englishRadioName } from "@/lib/english-text";
import {
  isValidLatLng,
  clampRadiusKm,
  sanitizeQuery,
  safeHttpUrl,
  isSafeYoutubeId,
  MAX_FEED_RADIUS_KM,
} from "@/lib/security";

function offsetAround(lat: number, lng: number, index: number, total: number) {
  const radiusDeg = 0.025 + (index % 5) * 0.008;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    lat: lat + Math.cos(angle) * radiusDeg,
    lng: lng + Math.sin(angle) * radiusDeg * 1.25,
  };
}

type RbStation = {
  stationuuid: string;
  name: string;
  url_resolved?: string;
  url?: string;
  homepage?: string;
  favicon?: string;
  bitrate?: number;
  codec?: string;
  tags?: string;
  country?: string;
  geo_lat?: number | null;
  geo_long?: number | null;
};

async function fetchRadios(
  city: string,
  country: string | undefined,
  countryCode: string | undefined,
  lat: number,
  lng: number
): Promise<RadioStation[]> {
  const base = "https://de1.api.radio-browser.info";
  const headers = { "User-Agent": "SentinelWatch/1.0", Accept: "application/json" };
  const stations: RadioStation[] = [];
  const seen = new Set<string>();

  const pushStation = (s: RbStation, index: number) => {
    const stream = s.url_resolved || s.url;
    if (!stream || seen.has(s.stationuuid)) return;
    seen.add(s.stationuuid);
    const hasGeo =
      typeof s.geo_lat === "number" &&
      typeof s.geo_long === "number" &&
      Number.isFinite(s.geo_lat!) &&
      Number.isFinite(s.geo_long!);
    const pos = hasGeo ? { lat: s.geo_lat!, lng: s.geo_long! } : offsetAround(lat, lng, index, 24);
    stations.push({
      id: `radio-${s.stationuuid}`,
      name: englishRadioName(s.name, country ?? toEnglishLabel(s.country ?? ""), stations.length),
      lat: pos.lat,
      lng: pos.lng,
      exact: false,
      streamUrl: stream,
      homepage: s.homepage,
      favicon: s.favicon,
      bitrate: s.bitrate,
      codec: s.codec,
      tags: s.tags,
      country: toEnglishLabel(s.country ?? country ?? ""),
      distanceKm: hasGeo ? Math.round(haversineKm(lat, lng, pos.lat, pos.lng) * 10) / 10 : 0,
      stationuuid: s.stationuuid,
    });
  };

  if (countryCode) {
    try {
      const r = await fetch(
        `${base}/json/stations/search?countrycode=${countryCode}&hidebroken=true&limit=40&order=clickcount&reverse=true`,
        { headers, signal: AbortSignal.timeout(10000), cache: "no-store" }
      );
      if (r.ok) (await r.json() as RbStation[]).forEach((s, i) => pushStation(s, i));
    } catch { /**/ }
  }

  if (stations.length < 10 && country) {
    try {
      const r = await fetch(
        `${base}/json/stations/bycountry/${encodeURIComponent(country)}?hidebroken=true&limit=40&order=clickcount&reverse=true`,
        { headers, signal: AbortSignal.timeout(10000), cache: "no-store" }
      );
      if (r.ok) (await r.json() as RbStation[]).forEach((s, i) => pushStation(s, stations.length + i));
    } catch { /**/ }
  }

  if (stations.length < 6) {
    try {
      const r = await fetch(
        `${base}/json/stations/search?name=${encodeURIComponent(city)}&hidebroken=true&limit=24&order=clickcount&reverse=true`,
        { headers, signal: AbortSignal.timeout(10000), cache: "no-store" }
      );
      if (r.ok) (await r.json() as RbStation[]).forEach((s, i) => pushStation(s, stations.length + i));
    } catch { /**/ }
  }

  const cityToken = city.trim().toLowerCase().split(/[\s,]+/)[0];
  return stations
    .sort((a, b) => {
      const aLocal = cityToken.length >= 3 && a.name.toLowerCase().includes(cityToken) ? 0 : 1;
      const bLocal = cityToken.length >= 3 && b.name.toLowerCase().includes(cityToken) ? 0 : 1;
      return aLocal - bLocal;
    })
    .slice(0, 32);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const city = sanitizeQuery(sp.get("city")) || "City";
  const country = sanitizeQuery(sp.get("country")) || undefined;
  const countryCode = sanitizeQuery(sp.get("countryCode"), 8).toUpperCase() || undefined;
  const radiusKm = Math.max(15, clampRadiusKm(Number(sp.get("radius")) || 55, 55, MAX_FEED_RADIUS_KM));
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Valid lat/lng required" }, { status: 400 });
  }

  const [{ cameras, sources }, radios] = await Promise.all([
    discoverLiveCameras(city, country, countryCode, lat, lng, radiusKm),
    fetchRadios(city, country, countryCode, lat, lng),
  ]);

  const safeCams = cameras.filter((cam) => {
    if (cam.kind === "youtube") return isSafeYoutubeId(cam.streamUrl);
    return Boolean(
      safeHttpUrl(cam.streamUrl, { allowHttp: cam.kind === "hls" || cam.kind === "image" })
    );
  });
  const safeRadios = radios.filter((r) => Boolean(safeHttpUrl(r.streamUrl, { allowHttp: true })));

  return NextResponse.json({
    city: toEnglishLabel(city),
    country: toEnglishLabel(country ?? ""),
    lat,
    lng,
    cameras: safeCams,
    radios: safeRadios,
    sources: { ...sources, radio: safeRadios.length },
    fetchedAt: Date.now(),
  });
}
