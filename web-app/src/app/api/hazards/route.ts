import { NextRequest, NextResponse } from "next/server";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import {
  buildRegionHazards,
  buildTouristSummary,
  groupHazardsByCategory,
  type RegionHazard,
} from "@/lib/region-advisories";
import { resolvePlaceEnglish } from "@/lib/resolve-place";
import { isValidLatLng } from "@/lib/security";

function severityFromMag(mag: number): RegionalEvent["severity"] {
  if (mag >= 6) return "critical";
  if (mag >= 5) return "high";
  if (mag >= 4) return "medium";
  return "low";
}

async function nearbyQuakes(lat: number, lng: number) {
  const events: RegionalEvent[] = [];
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const f of data.features ?? []) {
      const [qlng, qlat] = f.geometry.coordinates;
      const dist = haversineKm(lat, lng, qlat, qlng);
      if (dist > 400) continue;
      const mag = f.properties.mag ?? 0;
      events.push({
        id: `usgs-${f.id}`,
        kind: "earthquake",
        title: `M${mag.toFixed(1)} Earthquake`,
        detail: `${f.properties.place} · ${dist.toFixed(0)}km away`,
        lat: qlat,
        lng: qlng,
        distanceKm: dist,
        severity: severityFromMag(mag),
        timestamp: f.properties.time,
        source: "USGS",
        url: f.properties.url,
      });
    }
  } catch { /* ignore */ }
  return events.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
}

async function nearbyConflicts(lat: number, lng: number) {
  const events: RegionalEvent[] = [];
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?coord WHERE {
      ?item wdt:P31/wdt:P279* wd:Q3506041 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P582 ?end }
      FILTER(!BOUND(?end))
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 80
  `;
  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/sparql-results+json", "User-Agent": "SentinelWatch/1.0" },
    });
    if (!res.ok) return events;
    const data = await res.json();
    for (const row of data.results?.bindings ?? []) {
      const coord = row.coord?.value as string | undefined;
      const m = coord?.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      const clng = Number(m[1]);
      const clat = Number(m[2]);
      const dist = haversineKm(lat, lng, clat, clng);
      if (dist > 800) continue;
      events.push({
        id: `conflict-${row.item?.value?.split("/").pop()}`,
        kind: "conflict",
        title: row.itemLabel?.value ?? "Armed conflict",
        detail: `Ongoing conflict · ${dist.toFixed(0)}km away`,
        lat: clat,
        lng: clng,
        distanceKm: dist,
        severity: dist < 250 ? "critical" : "high",
        timestamp: Date.now(),
        source: "Wikidata",
        url: row.item?.value,
      });
    }
  } catch { /* ignore */ }
  return events.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6);
}

async function weatherHazard(lat: number, lng: number): Promise<RegionHazard | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weather_code ?? 0;
    const wind = data.current?.wind_speed_10m ?? 0;
    const temp = data.current?.temperature_2m ?? 20;
    if ([95, 96, 99, 82, 65, 75].includes(code) || wind >= 70) {
      return {
        id: "wx-extreme",
        category: "weather",
        level: wind >= 90 || code >= 95 ? "critical" : "high",
        title: "Severe weather right now",
        detail: `Live conditions: weather code ${code}, wind ${wind} km/h, ${temp}°C — postpone outdoor plans and seek shelter if needed.`,
      };
    }
    if (temp >= 40) {
      return {
        id: "wx-heat",
        category: "weather",
        level: "high",
        title: "Extreme heat advisory",
        detail: `${temp}°C — drink water hourly, avoid midday sun, watch for heat exhaustion symptoms.`,
        avoid: true,
      };
    }
    if (temp <= -15) {
      return {
        id: "wx-cold",
        category: "weather",
        level: "high",
        title: "Extreme cold advisory",
        detail: `${temp}°C — frostbite risk within minutes on exposed skin; limit time outdoors.`,
        avoid: true,
      };
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const full = req.nextUrl.searchParams.get("full") === "1";

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Valid lat/lng required" }, { status: 400 });
  }

  let placeName = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  let country = "";
  let countryCode = "";
  let region = "";

  try {
    const resolved = await resolvePlaceEnglish(lat, lng);
    placeName = resolved.name;
    country = resolved.country;
    countryCode = resolved.countryCode ?? "";
    region = resolved.region ?? "";
  } catch { /* ignore */ }

  const hazards = buildRegionHazards({ countryCode, placeName, full });

  const [wx, conflicts, quakes] = await Promise.all([
    weatherHazard(lat, lng),
    nearbyConflicts(lat, lng),
    nearbyQuakes(lat, lng),
  ]);
  if (wx) hazards.unshift(wx);

  for (const c of conflicts.slice(0, full ? 6 : 3)) {
    hazards.push({
      id: `live-${c.id}`,
      category: "conflict",
      level: c.severity === "critical" ? "critical" : "high",
      title: c.title,
      detail: c.detail,
      avoid: c.severity === "critical",
    });
  }

  const LEVEL_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
  hazards.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);

  const popupLimit = full ? hazards.length : 8;
  const trimmed = hazards.slice(0, popupLimit);
  const avoidList = hazards.filter((h) => h.avoid).map((h) => h.title);
  const summary = buildTouristSummary(placeName, hazards);

  return NextResponse.json({
    lat,
    lng,
    placeName,
    country,
    countryCode: countryCode || undefined,
    region: region || undefined,
    summary,
    hazards: trimmed,
    avoidList,
    sections: full ? groupHazardsByCategory(trimmed) : undefined,
    nearbyEvents: [...conflicts, ...quakes].slice(0, full ? 12 : 8),
    totalAdvisories: hazards.length,
    fetchedAt: Date.now(),
    disclaimer: "General situational awareness for tourists — not official government travel advice. Verify with local authorities and your embassy.",
  });
}
