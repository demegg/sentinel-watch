import { NextRequest, NextResponse } from "next/server";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import { isValidLatLng, clampRadiusKm, safeClientError } from "@/lib/security";
import { fetchUpstream } from "@/lib/net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Active wildfires + volcanoes from NASA EONET. */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const hasCenter = isValidLatLng(lat, lng);
  const radiusKm = clampRadiusKm(
    Number(req.nextUrl.searchParams.get("radius") ?? 12000),
    12000,
    20000
  );

  const fires: RegionalEvent[] = [];
  let error: string | undefined;

  try {
    // Fetch categories separately — comma lists can fail on some edge caches
    const [wf, vo] = await Promise.all([
      fetchUpstream(
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80&category=wildfires",
        { timeoutMs: 14000 }
      ),
      fetchUpstream(
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40&category=volcanoes",
        { timeoutMs: 14000 }
      ),
    ]);
    const events = [
      ...((wf.ok ? await wf.json() : { events: [] }).events ?? []),
      ...((vo.ok ? await vo.json() : { events: [] }).events ?? []),
    ];
    for (const ev of events) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      if (!geom?.coordinates) continue;
      const [elng, elat] = geom.coordinates;
      const dist = hasCenter ? haversineKm(lat, lng, elat, elng) : 0;
      if (hasCenter && dist > radiusKm) continue;
      const cat = ev.categories?.[0]?.id ?? "wildfires";
      fires.push({
        id: `fire-eonet-${ev.id}`,
        kind: cat === "volcanoes" ? "volcano" : "wildfire",
        title: ev.title,
        detail: `${ev.categories?.[0]?.title ?? "Fire"} · NASA EONET`,
        lat: elat,
        lng: elng,
        distanceKm: dist,
        severity: cat === "volcanoes" ? "high" : "medium",
        timestamp: geom.date ? Date.parse(geom.date) : Date.now(),
        source: "NASA EONET",
        url: ev.link,
      });
    }
  } catch (err) {
    error = safeClientError(err, "Fire feed unavailable");
  }

  fires.sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({
    source: "NASA EONET",
    count: fires.length,
    fires: fires.slice(0, 100),
    fetchedAt: Date.now(),
    error,
  });
}
