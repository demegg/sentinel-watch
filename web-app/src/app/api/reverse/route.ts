import { NextRequest, NextResponse } from "next/server";
import { resolvePlaceEnglish } from "@/lib/resolve-place";
import { isValidLatLng } from "@/lib/security";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Valid lat/lng required" }, { status: 400 });
  }

  try {
    const place = await resolvePlaceEnglish(lat, lng);
    return NextResponse.json({
      source: "nominatim",
      place: {
        id: "user-location",
        name: place.name,
        country: place.country,
        countryCode: place.countryCode,
        region: place.region,
        lat,
        lng,
        type: "user",
      },
    });
  } catch {
    return NextResponse.json({
      source: "fallback",
      place: {
        id: "user-location",
        name: "Your location",
        country: "",
        lat,
        lng,
        type: "user",
      },
    });
  }
}
