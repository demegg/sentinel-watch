import { NextRequest, NextResponse } from "next/server";
import { sanitizeQuery, safeClientError } from "@/lib/security";

export async function GET(req: NextRequest) {
  const q = sanitizeQuery(req.nextUrl.searchParams.get("q"));
  if (!q) {
    return NextResponse.json({ error: "Provide q" }, { status: 400 });
  }

  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!geo.ok) throw new Error("Geocoding failed");
    const geoData = await geo.json();
    const loc = geoData.results?.[0];
    if (!loc) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({
      source: "open-meteo-geocoding",
      place: {
        id: `geo-${loc.id ?? `${loc.latitude}-${loc.longitude}`}`,
        name: loc.name as string,
        country: (loc.country as string) ?? "",
        countryCode: (loc.country_code as string | undefined)?.toUpperCase(),
        lat: loc.latitude as number,
        lng: loc.longitude as number,
        timezone: (loc.timezone as string) ?? undefined,
        admin1: loc.admin1 as string | undefined,
      },
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: safeClientError(err, "Geocode unavailable"),
      },
      { status: 502 }
    );
  }
}
