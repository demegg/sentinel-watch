import { NextRequest, NextResponse } from "next/server";
import {
  haversineKm,
  type EventKind,
  type RegionalEvent,
} from "@/lib/data";
import {
  isValidLatLng,
  clampRadiusKm,
  MAX_EVENT_RADIUS_KM,
  safeHttpUrl,
} from "@/lib/security";

export const revalidate = 120;

function severityFromMag(mag: number): RegionalEvent["severity"] {
  if (mag >= 6) return "critical";
  if (mag >= 5) return "high";
  if (mag >= 4) return "medium";
  return "low";
}

function mapEonetCategory(id: string): EventKind {
  if (id === "wildfires") return "wildfire";
  if (id === "severeStorms") return "storm";
  if (id === "volcanoes") return "volcano";
  if (id === "floods") return "flood";
  if (id === "drought") return "drought";
  return "other";
}

function mapGdacsType(t: string): EventKind {
  switch (t) {
    case "EQ":
      return "earthquake";
    case "TC":
      return "storm";
    case "FL":
      return "flood";
    case "VO":
      return "volcano";
    case "WF":
      return "wildfire";
    case "DR":
      return "drought";
    default:
      return "disaster";
  }
}

async function fetchUsgsNearby(lat: number, lng: number, radiusKm: number) {
  const events: RegionalEvent[] = [];
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const f of data.features ?? []) {
      const [qlng, qlat, depth] = f.geometry.coordinates;
      const dist = haversineKm(lat, lng, qlat, qlng);
      if (dist > radiusKm) continue;
      const mag = f.properties.mag ?? 0;
      events.push({
        id: `usgs-${f.id}`,
        kind: "earthquake",
        title: `M${mag.toFixed(1)} Earthquake`,
        detail: `${f.properties.place} · depth ${Number(depth).toFixed(0)}km · ${dist.toFixed(0)}km away`,
        lat: qlat,
        lng: qlng,
        distanceKm: dist,
        severity: severityFromMag(mag),
        timestamp: f.properties.time,
        source: "USGS",
        url: f.properties.url,
      });
    }
  } catch {
    /* ignore */
  }
  return events;
}

async function fetchEonet(lat: number, lng: number, radiusKm: number) {
  const events: RegionalEvent[] = [];
  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100",
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const ev of data.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      if (!geom?.coordinates) continue;
      const [elng, elat] = geom.coordinates;
      const dist = haversineKm(lat, lng, elat, elng);
      if (dist > radiusKm) continue;
      const cat = ev.categories?.[0]?.id ?? "other";
      const kind = mapEonetCategory(cat);
      events.push({
        id: `eonet-${ev.id}`,
        kind,
        title: ev.title,
        detail: `${ev.categories?.[0]?.title ?? "Event"} · ${dist.toFixed(0)}km away`,
        lat: elat,
        lng: elng,
        distanceKm: dist,
        severity: kind === "wildfire" || kind === "storm" ? "high" : "medium",
        timestamp: geom.date ? Date.parse(geom.date) : Date.now(),
        source: "NASA EONET",
        url: ev.link,
      });
    }
  } catch {
    /* ignore */
  }
  return events;
}

async function fetchGdacs(lat: number, lng: number, radiusKm: number) {
  const events: RegionalEvent[] = [];
  try {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 86400000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromdate=${fromStr}&todate=${toStr}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const f of data.features ?? []) {
      const [glng, glat] = f.geometry?.coordinates ?? [];
      if (glat == null || glng == null) continue;
      const dist = haversineKm(lat, lng, glat, glng);
      if (dist > radiusKm) continue;
      const props = f.properties ?? {};
      const kind = mapGdacsType(props.eventtype);
      const alert = String(props.alertlevel ?? "").toLowerCase();
      const severity: RegionalEvent["severity"] = alert.includes("red")
        ? "critical"
        : alert.includes("orange")
          ? "high"
          : alert.includes("green")
            ? "low"
            : "medium";
      events.push({
        id: `gdacs-${props.eventtype}-${props.eventid}-${props.episodeid}`,
        kind,
        title: props.name || props.eventname || "GDACS Event",
        detail: `${String(props.htmldescription ?? props.description ?? kind)
          .replace(/<[^>]+>/g, " ")
          .slice(0, 120)} · ${dist.toFixed(0)}km away`,
        lat: glat,
        lng: glng,
        distanceKm: dist,
        severity,
        timestamp: Date.now(),
        source: "GDACS",
        url: props.url?.report || props.url?.details,
      });
    }
  } catch {
    /* ignore */
  }
  return events;
}

async function fetchConflicts(lat: number, lng: number, radiusKm: number) {
  const events: RegionalEvent[] = [];
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?coord WHERE {
      ?item wdt:P31/wdt:P279* wd:Q3506041 .
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P582 ?end }
      FILTER(!BOUND(?end))
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 100
  `;
  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "EIN-EarthIntelligence/1.0 (educational)",
      },
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
      if (dist > radiusKm) continue;
      const title = row.itemLabel?.value ?? "Armed conflict";
      const id = row.item?.value?.split("/").pop() ?? `${clat}-${clng}`;
      events.push({
        id: `conflict-${id}`,
        kind: "conflict",
        title,
        detail: `Ongoing armed conflict (Wikidata) · ${dist.toFixed(0)}km away`,
        lat: clat,
        lng: clng,
        distanceKm: dist,
        severity: dist < 250 ? "critical" : "high",
        timestamp: Date.now(),
        source: "Wikidata",
        url: row.item?.value,
      });
    }
  } catch {
    /* ignore */
  }
  return events;
}

async function fetchOutageRisks(lat: number, lng: number) {
  const events: RegionalEvent[] = [];
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,wind_speed_10m&timezone=auto`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    const code = data.current?.weather_code ?? 0;
    const wind = data.current?.wind_speed_10m ?? 0;
    const extreme = [95, 96, 99, 82, 65, 75].includes(code) || wind >= 75;
    if (extreme) {
      events.push({
        id: `outage-risk-${lat.toFixed(2)}-${lng.toFixed(2)}`,
        kind: "blackout",
        title: "Grid Stress Risk",
        detail: `Severe local weather (code ${code}, wind ${wind} km/h) — elevated blackout risk near focus`,
        lat,
        lng,
        distanceKm: 0,
        severity: wind >= 90 || code >= 95 ? "high" : "medium",
        timestamp: Date.now(),
        source: "Open-Meteo",
      });
    }
  } catch {
    /* ignore */
  }
  return events;
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const radiusKm = clampRadiusKm(
    Number(req.nextUrl.searchParams.get("radius") ?? 800),
    800,
    MAX_EVENT_RADIUS_KM
  );

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Valid lat/lng required" }, { status: 400 });
  }

  const [usgs, eonet, gdacs, conflicts, outages] = await Promise.all([
    fetchUsgsNearby(lat, lng, radiusKm),
    fetchEonet(lat, lng, radiusKm),
    fetchGdacs(lat, lng, radiusKm),
    fetchConflicts(lat, lng, radiusKm),
    fetchOutageRisks(lat, lng),
  ]);

  const seen = new Set<string>();
  const events = [...usgs, ...eonet, ...gdacs, ...conflicts, ...outages]
    .filter((e) => {
      const key = `${e.kind}-${e.title}-${e.lat.toFixed(2)}-${e.lng.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((e) => ({
      ...e,
      url: e.url ? safeHttpUrl(e.url) ?? undefined : undefined,
    }))
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      const sr = rank[a.severity] - rank[b.severity];
      if (sr !== 0) return sr;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 80);

  return NextResponse.json({
    lat,
    lng,
    radiusKm,
    count: events.length,
    events,
    sources: {
      usgs: usgs.length,
      eonet: eonet.length,
      gdacs: gdacs.length,
      conflicts: conflicts.length,
      outages: outages.length,
    },
    fetchedAt: Date.now(),
  });
}
