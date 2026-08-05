import { NextRequest, NextResponse } from "next/server";
import { isValidBBox, safeClientError } from "@/lib/security";
import { fetchUpstream } from "@/lib/net";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type PlaneState = {
  id: string;
  callsign: string;
  lat: number;
  lng: number;
  altitudeFt: number | null;
  velocityKts: number | null;
  heading: number | null;
  onGround: boolean;
  originCountry: string;
};

/**
 * Live aircraft via OpenSky Network (free, anonymous, rate-limited).
 * Must be proxied server-side (no CORS).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lamin = Number(sp.get("lamin"));
  const lomin = Number(sp.get("lomin"));
  const lamax = Number(sp.get("lamax"));
  const lomax = Number(sp.get("lomax"));

  if (!isValidBBox(lamin, lomin, lamax, lomax)) {
    return NextResponse.json(
      { error: "Valid lamin/lomin/lamax/lomax required (max ~40°×60°)" },
      { status: 400 }
    );
  }

  try {
    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    const res = await fetchUpstream(url, {
      timeoutMs: 12000,
      headers: { "User-Agent": "SentinelWatch/1.0" },
    });
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const data = await res.json();
    const planes: PlaneState[] = [];

    for (const row of data.states ?? []) {
      // [icao24, callsign, origin_country, time_position, last_contact,
      //  longitude, latitude, baro_altitude, on_ground, velocity, true_track, ...]
      const lat = row[6];
      const lng = row[5];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const onGround = !!row[8];
      const altM = row[7];
      const velMs = row[9];
      const track = row[10];
      planes.push({
        id: String(row[0] ?? `${lat}-${lng}`),
        callsign: String(row[1] ?? "").trim() || "UNKN",
        lat,
        lng,
        altitudeFt: Number.isFinite(altM) ? Math.round(altM * 3.28084) : null,
        velocityKts: Number.isFinite(velMs) ? Math.round(velMs * 1.94384) : null,
        heading: Number.isFinite(track) ? track : null,
        onGround,
        originCountry: String(row[2] ?? ""),
      });
      if (planes.length >= 180) break;
    }

    return NextResponse.json({
      source: "OpenSky Network",
      count: planes.length,
      planes,
      fetchedAt: Date.now(),
      time: data.time ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        planes: [],
        error: safeClientError(err, "Aircraft feed unavailable"),
      },
      { status: 502 }
    );
  }
}
