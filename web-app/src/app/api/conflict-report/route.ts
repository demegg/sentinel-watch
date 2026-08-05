import { NextRequest, NextResponse } from "next/server";
import { isValidLatLng, sanitizeQuery } from "@/lib/security";
import { findCombatZone, findNearestCombatZone } from "@/lib/combat-zones";
import { fetchTopicNews } from "@/lib/report-news";
import { fetchUpstream } from "@/lib/net";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import { computeRiskScore } from "@/lib/risk-score";

export const dynamic = "force-dynamic";

async function nearbyCrisis(lat: number, lng: number) {
  try {
    const res = await fetchUpstream(
      `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`,
      { timeoutMs: 8000 }
    );
    if (!res.ok) return [] as RegionalEvent[];
    const data = await res.json();
    const out: RegionalEvent[] = [];
    for (const f of data.features ?? []) {
      const [qlng, qlat] = f.geometry.coordinates;
      const dist = haversineKm(lat, lng, qlat, qlng);
      if (dist > 500) continue;
      const mag = f.properties.mag ?? 0;
      out.push({
        id: `usgs-${f.id}`,
        kind: "earthquake",
        title: `M${mag.toFixed(1)} Earthquake`,
        detail: `${f.properties.place} · ${dist.toFixed(0)}km`,
        lat: qlat,
        lng: qlng,
        distanceKm: dist,
        severity: mag >= 6 ? "critical" : mag >= 5 ? "high" : "medium",
        timestamp: f.properties.time,
        source: "USGS",
        url: f.properties.url,
      });
    }
    return out.slice(0, 6);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sanitizeQuery(sp.get("id"), 40);
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));

  // Only curated conflict zones — ignore attacker-supplied title/severity.
  const curated =
    findCombatZone(id) ||
    (isValidLatLng(lat, lng) ? findNearestCombatZone(lat, lng) : null);

  if (!curated) {
    return NextResponse.json(
      {
        error:
          "No curated conflict zone matches this location. Open a combat marker from the map or use a known zone id.",
      },
      { status: 404 }
    );
  }

  const title = curated.title;
  const clat = curated.lat;
  const clng = curated.lng;
  const severity = curated.severity;
  const radiusKm = curated.radiusKm;

  const newsQuery = `"${title}" (war OR conflict OR fighting OR ceasefire OR offensive OR airstrike OR militia OR politics OR sanctions) when:14d`;
  const [news, nearby, weather] = await Promise.all([
    fetchTopicNews(newsQuery, 12),
    nearbyCrisis(clat, clng),
    (async () => {
      try {
        const res = await fetchUpstream(
          `https://api.open-meteo.com/v1/forecast?latitude=${clat}&longitude=${clng}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`,
          { timeoutMs: 8000 }
        );
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    })(),
  ]);

  return NextResponse.json({
    type: "conflict",
    id: curated.id,
    title,
    lat: clat,
    lng: clng,
    radiusKm,
    severity,
    summary: curated.summary,
    guidance: curated.guidance,
    verified: true,
    news,
    nearbyEvents: nearby,
    weather: weather?.current
      ? {
          temperature_2m: weather.current.temperature_2m,
          wind_speed_10m: weather.current.wind_speed_10m,
          weather_code: weather.current.weather_code,
        }
      : null,
    risk: computeRiskScore({
      kind: "conflict",
      baseSeverity: severity,
      eventSeverities: nearby.map((e) => e.severity),
    }),
    sources: ["Curated", "Google News", "USGS", "Open-Meteo"],
    fetchedAt: Date.now(),
    disclaimer:
      "Conflict reports are open-source situational awareness only — not official military or government advice. Verify with your embassy.",
  });
}
