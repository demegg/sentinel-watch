import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "edge";
export const alt = "Sentinel Watch — global crisis monitor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #060810 0%, #0f172a 48%, #111827 100%)",
          color: "#f8fafc",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
            color: "#f97316",
            fontSize: 28,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#ef4444",
              boxShadow: "0 0 24px rgba(239,68,68,0.9)",
            }}
          />
          Live crisis map
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: 22,
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 34, color: "#94a3b8", maxWidth: 920, lineHeight: 1.35 }}>
          Real-time earthquakes, wildfires, storms, conflicts, cams & aircraft — {SITE_TAGLINE}
        </div>
      </div>
    ),
    { ...size }
  );
}
