import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download SentinelWatch Mobile",
  description: "Download the SentinelWatch app for Android.",
};

export default function DownloadPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #0a0e14 0%, #0f172a 50%, #0a0e14 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 24,
        color: "#e2e8f0",
      }}
    >
      {/* Back link */}
      <Link
        href="/"
        style={{
          position: "absolute", top: 20, left: 20,
          color: "#475569", fontSize: 13, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        ← Back to map
      </Link>

      {/* Card */}
      <div
        style={{
          maxWidth: 480, width: "100%",
          background: "rgba(17,24,39,0.95)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 0 60px rgba(239,68,68,0.06)",
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444, #f97316)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, margin: "0 auto 24px",
            boxShadow: "0 0 32px rgba(239,68,68,0.3)",
          }}
        >
          🛡️
        </div>

        <h1
          style={{
            margin: "0 0 8px", textAlign: "center",
            fontSize: 24, fontWeight: 700, color: "#f1f5f9",
          }}
        >
          SentinelWatch Mobile
        </h1>
        <p style={{ margin: "0 0 32px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Crisis monitoring on your Android device — offline-capable, real-time alerts.
        </p>

        {/* Features list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {[
            ["🗺️", "Crisis map with live event markers"],
            ["📶", "Offline caching — works without internet"],
            ["🔔", "Categorised alerts: quakes, fires, floods…"],
            ["⚙️", "Lightweight, dark-first UI"],
          ].map(([icon, text]) => (
            <div key={text as string} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#94a3b8" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <span>{text as string}</span>
            </div>
          ))}
        </div>

        {/* Download button */}
        <a
          href="/sentinelwatch-latest.apk"
          download
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "linear-gradient(135deg, #ef4444, #f97316)",
            color: "#fff", fontSize: 15, fontWeight: 600,
            padding: "14px 24px", borderRadius: 10,
            textDecoration: "none",
            boxShadow: "0 4px 24px rgba(239,68,68,0.25)",
            marginBottom: 12,
          }}
        >
          📲 Download APK (Android)
        </a>

        <p style={{ textAlign: "center", color: "#334155", fontSize: 11 }}>
          Version 1.4.0 · Enable &quot;Install unknown apps&quot; in Android settings
        </p>

        <div
          style={{
            marginTop: 24, padding: 12,
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.1)",
            borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#f87171" }}>iOS:</strong> iOS version coming soon. Use the{" "}
          <Link href="/" style={{ color: "#22d3ee" }}>web version</Link> on Safari for now — it works great on mobile.
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 32, fontSize: 11, color: "#1e293b" }}>
        SentinelWatch · Global Crisis Monitoring
      </p>
    </div>
  );
}
