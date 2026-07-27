import { NextResponse } from "next/server";
import { safeClientError } from "@/lib/security";

/** Latest RainViewer radar frame path (free, no key). */
export async function GET() {
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("RainViewer unavailable");
    const data = await res.json();
    const radar = data.radar?.past as Array<{ path: string; time: number }> | undefined;
    const nowcast = data.radar?.nowcast as Array<{ path: string; time: number }> | undefined;
    const frames = [...(radar ?? []), ...(nowcast ?? [])];
    const latest = frames[frames.length - 1];
    if (!latest?.path) throw new Error("No radar frames");

    if (!/^\/[A-Za-z0-9/_-]+$/.test(latest.path)) {
      throw new Error("Invalid radar path");
    }

    return NextResponse.json({
      path: latest.path,
      time: latest.time,
      tileUrl: `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: safeClientError(err, "Radar unavailable") },
      { status: 502 }
    );
  }
}
