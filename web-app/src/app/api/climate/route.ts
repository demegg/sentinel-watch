import { NextRequest, NextResponse } from "next/server";
import { WMO_WEATHER } from "@/lib/data";
import { isValidLatLng } from "@/lib/security";

const MAX_POINTS = 140;

function buildGridCells(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  cols: number,
  rows: number
) {
  const lats: number[] = [];
  const lngs: number[] = [];
  const cells: {
    lat: number;
    lng: number;
    bounds: [[number, number], [number, number]];
  }[] = [];

  for (let r = 0; r < rows; r++) {
    const south = minLat + (r / rows) * (maxLat - minLat);
    const north = minLat + ((r + 1) / rows) * (maxLat - minLat);
    const lat = (south + north) / 2;

    for (let c = 0; c < cols; c++) {
      const west = minLng + (c / cols) * (maxLng - minLng);
      const east = minLng + ((c + 1) / cols) * (maxLng - minLng);
      const lng = (west + east) / 2;

      lats.push(Math.round(lat * 1000) / 1000);
      lngs.push(Math.round(lng * 1000) / 1000);
      cells.push({
        lat,
        lng,
        bounds: [
          [south, west],
          [north, east],
        ],
      });
    }
  }

  return { lats, lngs, cells };
}

/** Sample a live temperature + wind grid across map bounds via Open-Meteo. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const minLat = Number(sp.get("minLat"));
  const maxLat = Number(sp.get("maxLat"));
  const minLng = Number(sp.get("minLng"));
  const maxLng = Number(sp.get("maxLng"));
  let cols = Math.min(14, Math.max(4, Number(sp.get("cols")) || 10));
  let rows = Math.min(14, Math.max(4, Number(sp.get("rows")) || 10));

  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "minLat/maxLat/minLng/maxLng required" }, { status: 400 });
  }
  if (!isValidLatLng(minLat, minLng) || !isValidLatLng(maxLat, maxLng)) {
    return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
  }
  if (maxLat < minLat || maxLng < minLng) {
    return NextResponse.json({ error: "Invalid bounding box" }, { status: 400 });
  }
  // Cap span so callers cannot force huge Open-Meteo grids
  if (maxLat - minLat > 40 || maxLng - minLng > 60) {
    return NextResponse.json({ error: "Bounding box too large" }, { status: 400 });
  }

  while (cols * rows > MAX_POINTS) {
    if (cols >= rows) cols -= 1;
    else rows -= 1;
  }

  const { lats, lngs, cells } = buildGridCells(minLat, maxLat, minLng, maxLng, cols, rows);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}` +
      `&longitude=${lngs.join(",")}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`;
    const res = await fetch(url, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error("Open-Meteo climate grid failed");
    const data = await res.json();

    const rowsData = Array.isArray(data) ? data : [data];
    const points = rowsData.map(
      (
        row: {
          latitude?: number;
          longitude?: number;
          current?: {
            temperature_2m?: number;
            wind_speed_10m?: number;
            wind_direction_10m?: number;
            weather_code?: number;
          };
        },
        i: number
      ) => {
        const code = row.current?.weather_code ?? 0;
        return {
          lat: row.latitude ?? cells[i].lat,
          lng: row.longitude ?? cells[i].lng,
          temp: row.current?.temperature_2m ?? 0,
          wind: row.current?.wind_speed_10m ?? 0,
          windDir: row.current?.wind_direction_10m ?? 0,
          weatherCode: code,
          condition: WMO_WEATHER[code] ?? `Code ${code}`,
          bounds: cells[i].bounds,
        };
      }
    );

    return NextResponse.json({
      count: points.length,
      points,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Climate unavailable", points: [] },
      { status: 502 }
    );
  }
}
