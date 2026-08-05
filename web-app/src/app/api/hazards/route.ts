import { NextRequest, NextResponse } from "next/server";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import {
  buildRegionHazards,
  buildTouristSummary,
  groupHazardsByCategory,
  type RegionHazard,
} from "@/lib/region-advisories";
import { resolvePlaceEnglish } from "@/lib/resolve-place";
import { computeRiskScore } from "@/lib/risk-score";
import { isValidLatLng, safeHttpUrl } from "@/lib/security";

function severityFromMag(mag: number): RegionalEvent["severity"] {
  if (mag >= 6) return "critical";
  if (mag >= 5) return "high";
  if (mag >= 4) return "medium";
  return "low";
}

function mapEonetCategory(id: string): RegionalEvent["kind"] {
  if (id === "wildfires") return "wildfire";
  if (id === "severeStorms") return "storm";
  if (id === "volcanoes") return "volcano";
  if (id === "floods") return "flood";
  if (id === "drought") return "drought";
  return "other";
}

function mapGdacsType(t: string): RegionalEvent["kind"] {
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
  } catch {
    /* ignore */
  }
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
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "SentinelWatch/1.0",
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
  } catch {
    /* ignore */
  }
  return events.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6);
}

async function nearbyEonet(lat: number, lng: number) {
  const events: RegionalEvent[] = [];
  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80",
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const ev of data.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      if (!geom?.coordinates) continue;
      const [elng, elat] = geom.coordinates;
      const dist = haversineKm(lat, lng, elat, elng);
      if (dist > 600) continue;
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
  return events.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
}

async function nearbyGdacs(lat: number, lng: number) {
  const events: RegionalEvent[] = [];
  try {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 86400000);
    const res = await fetch(
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromdate=${from.toISOString().slice(0, 10)}&todate=${to.toISOString().slice(0, 10)}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return events;
    const data = await res.json();
    for (const f of data.features ?? []) {
      const [glng, glat] = f.geometry?.coordinates ?? [];
      if (glat == null || glng == null) continue;
      const dist = haversineKm(lat, lng, glat, glng);
      if (dist > 700) continue;
      const props = f.properties ?? {};
      const kind = mapGdacsType(props.eventtype);
      const alert = String(props.alertlevel ?? "").toLowerCase();
      const severity: RegionalEvent["severity"] =
        alert.includes("red")
          ? "critical"
          : alert.includes("orange")
            ? "high"
            : "medium";
      events.push({
        id: `gdacs-${props.eventtype}-${props.eventid}-${props.episodeid}`,
        kind,
        title: props.name || props.eventname || "GDACS alert",
        detail: `${kind} · ${dist.toFixed(0)}km away`,
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
  return events.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
}

type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
};

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function regionNews(placeName: string, country: string) {
  const items: NewsItem[] = [];
  // Political / governance focus for region reports (not a map layer)
  const queries = [
    `${placeName} ${country} (politics OR government OR election OR parliament OR protest OR sanctions OR diplomacy OR conflict) when:14d`,
    `${country} (politics OR government OR election OR war OR ceasefire) when:7d`,
  ];
  try {
    for (const q of queries) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "SentinelWatch/1.0",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const block of xml.split(/<item[\s>]/i).slice(1, 10)) {
        const title = decodeXml(
          block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
        );
        const link = decodeXml(
          block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
            block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
            ""
        );
        const source =
          decodeXml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "") ||
          "Google News";
        const pub = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
        const desc = decodeXml(
          block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? ""
        );
        const safeLink = safeHttpUrl(link);
        if (!title || !safeLink) continue;
        if (items.some((n) => n.title.toLowerCase() === title.toLowerCase())) continue;
        items.push({
          id: `news-${items.length}-${title.slice(0, 18).replace(/\W+/g, "")}`,
          title: title.slice(0, 220),
          link: safeLink,
          source: source.slice(0, 80),
          publishedAt: pub ? Date.parse(pub) || Date.now() : Date.now(),
          summary: desc.slice(0, 180),
        });
        if (items.length >= 12) break;
      }
      if (items.length >= 12) break;
    }
  } catch {
    /* ignore */
  }
  return items.slice(0, 12);
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
  } catch {
    /* ignore */
  }
  return null;
}

function mergeUniqueEvents(lists: RegionalEvent[][], cap: number) {
  const seen = new Set<string>();
  const out: RegionalEvent[] = [];
  for (const list of lists) {
    for (const e of list) {
      const key = e.id || `${e.kind}-${e.title}-${e.lat.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= cap) return out;
    }
  }
  return out;
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
  } catch {
    /* ignore */
  }

  const hazards = buildRegionHazards({ countryCode, placeName, full });

  const [wx, conflicts, quakes, eonet, gdacs, news] = await Promise.all([
    weatherHazard(lat, lng),
    nearbyConflicts(lat, lng),
    nearbyQuakes(lat, lng),
    nearbyEonet(lat, lng),
    nearbyGdacs(lat, lng),
    full ? regionNews(placeName, country) : Promise.resolve([] as NewsItem[]),
  ]);
  if (wx) hazards.unshift(wx);

  for (const c of [
    ...conflicts,
    ...gdacs.filter((g) => g.severity === "critical" || g.severity === "high"),
  ].slice(0, full ? 8 : 3)) {
    hazards.push({
      id: `live-${c.id}`,
      category: c.kind === "conflict" ? "conflict" : "weather",
      level:
        c.severity === "critical"
          ? "critical"
          : c.severity === "high"
            ? "high"
            : "moderate",
      title: c.title,
      detail: `${c.detail} · source ${c.source}`,
      avoid: c.severity === "critical",
    });
  }

  for (const e of eonet.slice(0, full ? 4 : 2)) {
    hazards.push({
      id: `live-${e.id}`,
      category: e.kind === "wildfire" ? "other" : "weather",
      level:
        e.severity === "critical"
          ? "critical"
          : e.severity === "high"
            ? "high"
            : "moderate",
      title: e.title,
      detail: `${e.detail} · NASA EONET`,
    });
  }

  const LEVEL_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
  hazards.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);

  const popupLimit = full ? hazards.length : 8;
  const trimmed = hazards.slice(0, popupLimit);
  const avoidList = hazards.filter((h) => h.avoid).map((h) => h.title);
  const summary = buildTouristSummary(placeName, hazards);
  const nearbyEvents = mergeUniqueEvents(
    [conflicts, quakes, gdacs, eonet],
    full ? 16 : 8
  );

  const sources = [
    "Advisories",
    quakes.length ? "USGS" : null,
    eonet.length ? "NASA EONET" : null,
    gdacs.length ? "GDACS" : null,
    conflicts.length ? "Wikidata" : null,
    wx ? "Open-Meteo" : null,
    news.length ? "Google News" : null,
  ].filter(Boolean) as string[];

  const risk = computeRiskScore({
    kind: "region",
    hazardLevels: hazards.map((h) => h.level),
    eventSeverities: nearbyEvents.map((e) => e.severity),
    avoidCount: avoidList.length,
  });

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
    nearbyEvents,
    news,
    sources,
    risk,
    totalAdvisories: hazards.length,
    fetchedAt: Date.now(),
    disclaimer:
      "General situational awareness for tourists — not official government travel advice. Verify with local authorities and your embassy. Source timestamps shown when available.",
  });
}
