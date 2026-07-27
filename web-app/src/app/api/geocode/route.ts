import { NextRequest, NextResponse } from "next/server";
import { sanitizeQuery, safeClientError, MAX_GEOCODE_RESULTS } from "@/lib/security";

export async function GET(req: NextRequest) {
  const q = sanitizeQuery(req.nextUrl.searchParams.get("q"));
  if (!q) {
    return NextResponse.json({ error: "Provide q" }, { status: 400 });
  }

  const countRaw = Number(req.nextUrl.searchParams.get("count") ?? 1);
  const count = Math.min(
    MAX_GEOCODE_RESULTS,
    Math.max(1, Number.isFinite(countRaw) ? Math.round(countRaw) : 1)
  );

  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!geo.ok) throw new Error("Geocoding failed");
    const geoData = await geo.json();
    const rows = (geoData.results ?? []) as Array<Record<string, unknown>>;
    if (!rows.length) {
      return NextResponse.json({ error: "Place not found", results: [] }, { status: 404 });
    }

    const results = rows.map((loc) => ({
      id: `geo-${loc.id ?? `${loc.latitude}-${loc.longitude}`}`,
      name: loc.name as string,
      country: (loc.country as string) ?? "",
      countryCode: (loc.country_code as string | undefined)?.toUpperCase(),
      lat: loc.latitude as number,
      lng: loc.longitude as number,
      timezone: (loc.timezone as string) ?? undefined,
      admin1: loc.admin1 as string | undefined,
    }));

    return NextResponse.json({
      source: "open-meteo-geocoding",
      place: results[0],
      results,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: safeClientError(err, "Geocode unavailable"),
        results: [],
      },
      { status: 502 }
    );
  }
}
