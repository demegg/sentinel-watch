import { NextRequest, NextResponse } from "next/server";
import { isValidLatLng, sanitizeQuery, safeClientError } from "@/lib/security";
import { fetchTopicNews } from "@/lib/report-news";
import { fetchUpstream } from "@/lib/net";
import { computeRiskScore } from "@/lib/risk-score";
import { haversineKm, type RegionalEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

function stormGuidance(severity: string, kind: string): string[] {
  const base = [
    "Monitor official meteorological warnings for your exact location.",
    "Secure outdoor objects; charge devices and prepare water / meds.",
    "Avoid flooded roads and coastal surge zones.",
  ];
  if (severity === "critical" || kind === "storm") {
    return [
      "If under a hurricane / typhoon warning, evacuate when ordered.",
      "Stay indoors away from windows during peak winds.",
      ...base,
    ];
  }
  if (kind === "flood") {
    return [
      "Never drive through floodwater — turn around, don’t drown.",
      "Move valuables and people to higher floors early.",
      ...base,
    ];
  }
  return base;
}

function mapEonetKind(id: string): RegionalEvent["kind"] {
  if (id === "floods") return "flood";
  return "storm";
}

/** Resolve storm identity from live feeds — ignore attacker-supplied titles. */
async function resolveStorm(
  lat: number,
  lng: number,
  eventId: string
): Promise<RegionalEvent | null> {
  const candidates: RegionalEvent[] = [];

  try {
    const res = await fetchUpstream(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120&category=severeStorms",
      { timeoutMs: 12000 }
    );
    if (res.ok) {
      const data = await res.json();
      for (const ev of data.events ?? []) {
        const geom = ev.geometry?.[ev.geometry.length - 1];
        const coords = geom?.coordinates;
        if (!coords || coords.length < 2) continue;
        const elng = Number(coords[0]);
        const elat = Number(coords[1]);
        if (!Number.isFinite(elat) || !Number.isFinite(elng)) continue;
        const dist = haversineKm(lat, lng, elat, elng);
        if (dist > 800) continue;
        const mag = Number(geom?.magnitudeValue);
        const id = `storm-eonet-${ev.id}`;
        candidates.push({
          id,
          kind: mapEonetKind(ev.categories?.[0]?.id ?? "severeStorms"),
          title: String(ev.title ?? "Severe storm").slice(0, 160),
          detail: Number.isFinite(mag)
            ? `${mag} ${geom?.magnitudeUnit ?? "kts"} · NASA EONET`
            : "Severe storm · NASA EONET",
          lat: elat,
          lng: elng,
          distanceKm: dist,
          severity: mag >= 100 ? "critical" : mag >= 64 ? "high" : "medium",
          timestamp: geom.date ? Date.parse(geom.date) : Date.now(),
          source: "NASA EONET",
          url: ev.link,
        });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const to = new Date();
    const from = new Date(Date.now() - 14 * 86400000);
    const res = await fetchUpstream(
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL&fromdate=${from.toISOString().slice(0, 10)}&todate=${to.toISOString().slice(0, 10)}`,
      { timeoutMs: 10000 }
    );
    if (res.ok) {
      const data = await res.json();
      for (const f of data.features ?? []) {
        const [glng, glat] = f.geometry?.coordinates ?? [];
        if (glat == null || glng == null) continue;
        const dist = haversineKm(lat, lng, glat, glng);
        if (dist > 800) continue;
        const props = f.properties ?? {};
        const alert = String(props.alertlevel ?? "").toLowerCase();
        candidates.push({
          id: `storm-gdacs-${props.eventtype}-${props.eventid}`,
          kind: props.eventtype === "FL" ? "flood" : "storm",
          title: String(props.name || props.eventname || "Tropical system").slice(0, 160),
          detail: `GDACS ${props.eventtype} · alert ${props.alertlevel ?? "n/a"}`,
          lat: glat,
          lng: glng,
          distanceKm: dist,
          severity: alert.includes("red")
            ? "critical"
            : alert.includes("orange")
              ? "high"
              : "medium",
          timestamp: Date.now(),
          source: "GDACS",
          url: props.url?.report || props.url?.details,
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (eventId) {
    const byId = candidates.find((c) => c.id === eventId);
    if (byId) return byId;
  }
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates[0] ?? null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const eventId = sanitizeQuery(sp.get("id"), 80);

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Valid lat/lng required" }, { status: 400 });
  }

  let live: RegionalEvent | null = null;
  try {
    live = await resolveStorm(lat, lng, eventId);
  } catch (err) {
    return NextResponse.json(
      { error: safeClientError(err, "Storm feeds unavailable") },
      { status: 502 }
    );
  }

  const title = live?.title ?? "Severe weather system";
  const kind = live?.kind ?? "storm";
  const severity = live?.severity ?? "medium";
  const source = live?.source ?? "Public weather feeds";
  const verified = Boolean(live);
  const clat = live?.lat ?? lat;
  const clng = live?.lng ?? lng;

  const newsQuery = verified
    ? `"${title}" (storm OR hurricane OR typhoon OR cyclone OR flood OR rain OR wind OR evacuation) when:14d`
    : `(storm OR hurricane OR typhoon OR cyclone OR flood) near:${clat.toFixed(1)},${clng.toFixed(1)} when:7d`;

  const [news, forecast] = await Promise.all([
    fetchTopicNews(newsQuery, 12),
    (async () => {
      try {
        const res = await fetchUpstream(
          `https://api.open-meteo.com/v1/forecast?latitude=${clat}&longitude=${clng}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,weather_code&daily=precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=3`,
          { timeoutMs: 10000 }
        );
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    })(),
  ]);

  const wind = forecast?.current?.wind_speed_10m;
  const gust = forecast?.current?.wind_gusts_10m;
  const precip = forecast?.current?.precipitation;

  const summary = verified
    ? live!.detail ||
      `Active ${kind} system reported near ${clat.toFixed(2)}°, ${clng.toFixed(2)}° (${source}). Local impacts depend on track and intensity — verify with national weather services.`
    : `No matching active storm feed was found at ${lat.toFixed(2)}°, ${lng.toFixed(2)}°. Showing local weather only — this is not a verified storm warning.`;

  return NextResponse.json({
    type: "storm",
    id: live?.id || `storm-loc-${lat.toFixed(2)}-${lng.toFixed(2)}`,
    title,
    kind,
    severity,
    lat: clat,
    lng: clng,
    source,
    summary,
    verified,
    guidance: stormGuidance(severity, kind),
    conditions: forecast?.current
      ? {
          temperature_2m: forecast.current.temperature_2m,
          wind_speed_10m: wind,
          wind_gusts_10m: gust,
          precipitation: precip,
          weather_code: forecast.current.weather_code,
        }
      : null,
    outlook: forecast?.daily
      ? {
          dates: forecast.daily.time?.slice(0, 3) ?? [],
          precip: forecast.daily.precipitation_sum?.slice(0, 3) ?? [],
          windMax: forecast.daily.wind_speed_10m_max?.slice(0, 3) ?? [],
        }
      : null,
    news,
    risk: computeRiskScore({
      kind: "storm",
      baseSeverity: severity,
    }),
    sources: [source, "Google News", "Open-Meteo"].filter(Boolean),
    fetchedAt: Date.now(),
    disclaimer:
      "Storm reports aggregate public feeds for awareness only — follow your national meteorological service for warnings and evacuations.",
  });
}
