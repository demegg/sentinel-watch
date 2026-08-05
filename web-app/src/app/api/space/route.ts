import { NextResponse } from "next/server";
import { safeClientError } from "@/lib/security";

export const revalidate = 120;

/**
 * Space weather snapshot from NOAA SWPC (free, no key).
 * Used for the Space layer HUD + polar awareness.
 */
export async function GET() {
  try {
    const [kpRes, alertRes] = await Promise.all([
      fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(10000),
      }),
      fetch("https://services.swpc.noaa.gov/products/noaa-scales.json", {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    let kp = 0;
    let kpTime: string | null = null;
    if (kpRes.ok) {
      const rows = (await kpRes.json()) as Array<{
        kp_index?: number;
        time_tag?: string;
      }>;
      const last = rows[rows.length - 1];
      kp = Number(last?.kp_index ?? 0);
      kpTime = last?.time_tag ?? null;
    }

    let radio = "G0";
    let solar = "R0";
    let geo = "G0";
    if (alertRes.ok) {
      const scales = await alertRes.json();
      const now = scales?.["0"] ?? scales?.["-1"] ?? {};
      geo = String(now?.G?.Scale ?? "G0");
      radio = String(now?.R?.Scale ?? "R0");
      solar = String(now?.S?.Scale ?? "S0");
    }

    const level =
      kp >= 7 || geo.startsWith("G4") || geo.startsWith("G5")
        ? "severe"
        : kp >= 5 || geo.startsWith("G2") || geo.startsWith("G3")
          ? "elevated"
          : "quiet";

    return NextResponse.json({
      source: "NOAA SWPC",
      kp,
      kpTime,
      scales: { geo, radio, solar },
      level,
      auroraLikely: kp >= 5,
      summary:
        level === "severe"
          ? "Severe geomagnetic activity — aurora possible mid-latitudes, HF radio disruption risk."
          : level === "elevated"
            ? "Elevated space weather — polar aurora more active than usual."
            : "Quiet space weather — normal HF/GPS conditions.",
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: safeClientError(err, "Space weather unavailable") },
      { status: 502 }
    );
  }
}
