import { NextRequest, NextResponse } from "next/server";
import { haversineKm } from "@/lib/data";
import { isValidLatLng, clampRadiusKm } from "@/lib/security";
import { CURATED_COMBAT_ZONES } from "@/lib/combat-zones";
import { fetchUpstream } from "@/lib/net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type CombatZone = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceKm: number;
  radiusKm: number;
  severity: "high" | "critical";
  source: string;
  url?: string;
};

function parsePoint(coord: string | undefined): { lat: number; lng: number } | null {
  const m = coord?.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Combat / conflict zones — curated hotspots + light Wikidata enrichment. */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const hasCenter = isValidLatLng(lat, lng);
  const radiusKm = clampRadiusKm(
    Number(req.nextUrl.searchParams.get("radius") ?? 12000),
    12000,
    20000
  );

  const zones: CombatZone[] = [];

  for (const z of CURATED_COMBAT_ZONES) {
    const dist = hasCenter ? haversineKm(lat, lng, z.lat, z.lng) : 0;
    if (hasCenter && dist > radiusKm) continue;
    zones.push({
      id: z.id,
      title: z.title,
      lat: z.lat,
      lng: z.lng,
      distanceKm: dist,
      radiusKm: z.radiusKm,
      severity: z.severity,
      source: "Curated",
    });
  }

  // Fast, simple Wikidata pull (optional enrichment — ignore failures)
  try {
    const query = `
      SELECT ?item ?itemLabel ?coord WHERE {
        VALUES ?type { wd:Q3506041 wd:Q8663 }
        ?item wdt:P31 ?type ; wdt:P625 ?coord .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 25
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetchUpstream(url, {
      timeoutMs: 8000,
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "SentinelWatch/1.0 (crisis-awareness; local-beta)",
      },
    });
    if (res.ok) {
      const data = await res.json();
      for (const row of data.results?.bindings ?? []) {
        const pt = parsePoint(row.coord?.value);
        if (!pt) continue;
        const dist = hasCenter ? haversineKm(lat, lng, pt.lat, pt.lng) : 0;
        if (hasCenter && dist > radiusKm) continue;
        const title = row.itemLabel?.value ?? "Armed conflict";
        // Skip ancient / very short labels that look like historical wars without modern context
        if (/war of \d{3,4}|battle of/i.test(title) && !/\b(20\d{2}|ongoing|insurgency|conflict)\b/i.test(title)) {
          continue;
        }
        zones.push({
          id: `wd-${row.item?.value?.split("/").pop()}`,
          title,
          lat: pt.lat,
          lng: pt.lng,
          distanceKm: dist,
          radiusKm: dist < 300 ? 160 : 260,
          severity: dist < 250 ? "critical" : "high",
          source: "Wikidata",
          url: row.item?.value,
        });
      }
    }
  } catch {
    /* curated zones still returned */
  }

  const seen = new Set<string>();
  const unique = zones.filter((z) => {
    const key = `${z.lat.toFixed(1)},${z.lng.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const rank = { critical: 0, high: 1 };
    return rank[a.severity] - rank[b.severity] || a.distanceKm - b.distanceKm;
  });

  return NextResponse.json({
    source: "Curated + Wikidata",
    count: unique.length,
    zones: unique.slice(0, 60),
    fetchedAt: Date.now(),
    disclaimer: "Approximate open-source conflict awareness — not official military intel.",
  });
}
