import { NextRequest, NextResponse } from "next/server";
import { isValidBBox, safeClientError, sanitizeQuery } from "@/lib/security";
import { fetchUpstream } from "@/lib/net";
import type { PlaneState } from "@/lib/aircraft";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const query = sanitizeQuery(sp.get("q"), 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const directIcao = /^[0-9A-F]{6}$/.test(query);
  const validBox = isValidBBox(lamin, lomin, lamax, lomax);

  if (!validBox && !directIcao) {
    return NextResponse.json(
      { error: "A valid map area is required, or search by a 6-character ICAO24 hex id." },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (directIcao) {
      params.set("icao24", query.toLowerCase());
    } else {
      params.set("lamin", String(lamin));
      params.set("lomin", String(lomin));
      params.set("lamax", String(lamax));
      params.set("lomax", String(lomax));
    }
    const url = `https://opensky-network.org/api/states/all?${params.toString()}`;
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
      const plane: PlaneState = {
        id: String(row[0] ?? `${lat}-${lng}`),
        callsign: String(row[1] ?? "").trim() || "UNKN",
        lat,
        lng,
        altitudeFt: Number.isFinite(altM) ? Math.round(altM * 3.28084) : null,
        velocityKts: Number.isFinite(velMs) ? Math.round(velMs * 1.94384) : null,
        heading: Number.isFinite(track) ? track : null,
        onGround,
        originCountry: String(row[2] ?? ""),
      };
      if (
        query &&
        !directIcao &&
        !plane.callsign.replace(/\s/g, "").toUpperCase().includes(query) &&
        !plane.id.toUpperCase().includes(query)
      ) {
        continue;
      }
      planes.push(plane);
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
