import { NextRequest, NextResponse } from "next/server";
import { WMO_WEATHER } from "@/lib/data";
import { resolvePlaceEnglish } from "@/lib/resolve-place";
import { isValidLatLng, sanitizeQuery, safeClientError } from "@/lib/security";

export async function GET(req: NextRequest) {
  const cityRaw = sanitizeQuery(req.nextUrl.searchParams.get("city"));
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");

  try {
    let lat: number;
    let lng: number;
    let name = cityRaw || "Location";
    let country = "";

    if (latParam && lngParam) {
      lat = Number(latParam);
      lng = Number(lngParam);
      if (!isValidLatLng(lat, lng)) {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
      }
      const resolved = await resolvePlaceEnglish(lat, lng);
      name = resolved.name;
      country = resolved.country;
    } else if (cityRaw) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityRaw)}&count=1&language=en`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
      );
      if (!geo.ok) throw new Error("Geocoding failed");
      const geoData = await geo.json();
      const loc = geoData.results?.[0];
      if (!loc) {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }
      lat = loc.latitude;
      lng = loc.longitude;
      name = loc.name;
      country = loc.country ?? "";
    } else {
      return NextResponse.json(
        { error: "Provide city or lat/lng" },
        { status: 400 }
      );
    }

    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day&timezone=auto`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!weather.ok) throw new Error("Weather fetch failed");
    const w = await weather.json();
    const code = w.current?.weather_code ?? 0;

    return NextResponse.json({
      source: "open-meteo",
      city: name,
      country,
      lat,
      lng,
      timezone: w.timezone,
      current: {
        ...w.current,
        condition: WMO_WEATHER[code] ?? `Code ${code}`,
      },
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        error: safeClientError(err, "Weather unavailable"),
      },
      { status: 502 }
    );
  }
}
