import { NextRequest, NextResponse } from "next/server";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import { isValidLatLng, clampRadiusKm, safeClientError } from "@/lib/security";
import { fetchUpstream } from "@/lib/net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function mapEonet(id: string): RegionalEvent["kind"] {
  if (id === "severeStorms") return "storm";
  if (id === "floods") return "flood";
  return "storm";
}

/**
 * Storm catcher: NASA EONET severe storms + GDACS tropical cyclones / floods.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const hasCenter = isValidLatLng(lat, lng);
  const radiusKm = clampRadiusKm(
    Number(req.nextUrl.searchParams.get("radius") ?? 12000),
    12000,
    20000
  );

  const storms: RegionalEvent[] = [];
  const errors: string[] = [];

  try {
    const res = await fetchUpstream(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120&category=severeStorms",
      { timeoutMs: 14000, next: { revalidate: 180 } }
    );
    if (!res.ok) throw new Error(`EONET ${res.status}`);
    const data = await res.json();
    for (const ev of data.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      const coords = geom?.coordinates;
      if (!coords || coords.length < 2) continue;
      const elng = Number(coords[0]);
      const elat = Number(coords[1]);
      if (!Number.isFinite(elat) || !Number.isFinite(elng)) continue;
      const dist = hasCenter ? haversineKm(lat, lng, elat, elng) : 0;
      if (hasCenter && dist > radiusKm) continue;
      const mag = Number(geom?.magnitudeValue);
      const severity: RegionalEvent["severity"] =
        mag >= 100 ? "critical" : mag >= 64 ? "high" : "medium";
      storms.push({
        id: `storm-eonet-${ev.id}`,
        kind: mapEonet(ev.categories?.[0]?.id ?? "severeStorms"),
        title: ev.title,
        detail: Number.isFinite(mag)
          ? `${mag} ${geom?.magnitudeUnit ?? "kts"} · NASA EONET`
          : `Severe storm · NASA EONET`,
        lat: elat,
        lng: elng,
        distanceKm: dist,
        severity,
        timestamp: geom.date ? Date.parse(geom.date) : Date.now(),
        source: "NASA EONET",
        url: ev.link,
      });
    }
  } catch (err) {
    errors.push(safeClientError(err, "EONET unavailable"));
  }

  try {
    const to = new Date();
    const from = new Date(Date.now() - 14 * 86400000);
    const res = await fetchUpstream(
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL&fromdate=${from.toISOString().slice(0, 10)}&todate=${to.toISOString().slice(0, 10)}`,
      { timeoutMs: 12000, next: { revalidate: 180 } }
    );
    if (!res.ok) throw new Error(`GDACS ${res.status}`);
    const data = await res.json();
    for (const f of data.features ?? []) {
      const [glng, glat] = f.geometry?.coordinates ?? [];
      if (glat == null || glng == null) continue;
      const dist = hasCenter ? haversineKm(lat, lng, glat, glng) : 0;
      if (hasCenter && dist > radiusKm) continue;
      const props = f.properties ?? {};
      const alert = String(props.alertlevel ?? "").toLowerCase();
      storms.push({
        id: `storm-gdacs-${props.eventtype}-${props.eventid}`,
        kind: props.eventtype === "FL" ? "flood" : "storm",
        title: props.name || props.eventname || "Tropical system",
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
  } catch (err) {
    errors.push(safeClientError(err, "GDACS unavailable"));
  }

  // Dedupe by rough position + title
  const seen = new Set<string>();
  const unique = storms.filter((s) => {
    const key = `${s.title.toLowerCase().slice(0, 24)}-${s.lat.toFixed(1)}-${s.lng.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[a.severity] - rank[b.severity] || a.distanceKm - b.distanceKm;
  });

  return NextResponse.json({
    source: "NASA EONET + GDACS",
    count: unique.length,
    storms: unique.slice(0, 80),
    fetchedAt: Date.now(),
    errors: errors.length ? errors : undefined,
  });
}
