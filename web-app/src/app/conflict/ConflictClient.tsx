"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import TrustBar, { SourceBadge } from "@/components/ui/TrustBar";
import RelativeTime from "@/components/ui/RelativeTime";
import RiskBadge from "@/components/ui/RiskBadge";
import ShareBrief from "@/components/ui/ShareBrief";
import type { RegionalEvent } from "@/lib/data";
import type { RiskScore } from "@/lib/risk-score";

type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
};

type ConflictReport = {
  title: string;
  lat: number;
  lng: number;
  radiusKm: number;
  severity: string;
  summary: string;
  guidance: string[];
  news: NewsItem[];
  nearbyEvents: RegionalEvent[];
  weather: { temperature_2m: number; wind_speed_10m: number } | null;
  sources: string[];
  risk?: RiskScore;
  fetchedAt: number;
  disclaimer: string;
};

const LEVEL: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#facc15",
};

export default function ConflictPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="sw-region-page" style={pageStyle}>
          <LoadingState label="Loading conflict report…" />
        </div>
      }
    >
      <ConflictPage />
    </Suspense>
  );
}

function ConflictPage() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ConflictReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const qs = sp.toString();
    setLoading(true);
    void fetch(`/api/conflict-report?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setReport(null);
        } else setReport(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load conflict report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sp]);

  return (
    <div className="sw-region-page" style={pageStyle}>
      <Link href="/app" style={backLinkStyle}>
        ← Back to map
      </Link>

      <div className="sw-report-shell">
        <header className="sw-report-header">
          <div className="sw-report-header-main">
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#ef4444", marginBottom: 8 }}>
              CONFLICT REPORT
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>
              {report?.title ?? (loading ? "Loading…" : "Conflict")}
            </h1>
            {report && (
              <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
                <span style={{ color: LEVEL[report.severity] ?? "#f97316", fontWeight: 700, letterSpacing: "0.1em" }}>
                  {report.severity.toUpperCase()}
                </span>
                <span>~{report.radiusKm} km awareness radius</span>
                <span>
                  {report.lat.toFixed(3)}°, {report.lng.toFixed(3)}°
                </span>
              </div>
            )}
          </div>
          {report && (
            <ShareBrief title={`Conflict report · ${report.title}`} text={report.summary} />
          )}
        </header>

        {loading && (
          <div className="sw-report-card">
            <LoadingState label="Compiling conflict report…" sublabel="News, local conditions, guidance" />
          </div>
        )}
        {error && !loading && <p style={{ color: "#fca5a5" }}>{error}</p>}

        {!loading && report && (
          <>
            <div className="sw-report-grid">
              {report.risk && (
                <RiskBadge
                  level={report.risk.level}
                  score={report.risk.score}
                  label={report.risk.label}
                  reasons={report.risk.reasons}
                />
              )}
              <TrustBar sources={report.sources} fetchedAt={report.fetchedAt} note={report.disclaimer} />
            </div>

            <div className="sw-report-grid">
              <div className="sw-report-stack">
                <section className="sw-report-card" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                  <div style={sectionTitle}>Situation overview</div>
                  <p style={{ margin: 0, fontSize: 14, color: "#cbd5e1", lineHeight: 1.65 }}>{report.summary}</p>
                  {report.weather && (
                    <div style={{ marginTop: 14, fontSize: 12, color: "#64748b" }}>
                      Local conditions: {report.weather.temperature_2m}°C · wind {report.weather.wind_speed_10m} km/h
                    </div>
                  )}
                </section>

                <section className="sw-report-card">
                  <div style={{ ...sectionTitle, color: "#f97316" }}>Traveler / operator guidance</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.guidance.map((g) => (
                      <li key={g} style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>
                        {g}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="sw-report-stack">
                <section className="sw-report-card">
                  <div style={{ ...sectionTitle, color: "#a855f7" }}>Political & conflict news</div>
                  {report.news.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {report.news.map((n) => (
                        <a
                          key={n.id}
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>{n.title}</div>
                          {n.summary && (
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>{n.summary}</div>
                          )}
                          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "#475569" }}>
                            <SourceBadge source={n.source === "Google News" ? "Google News" : n.source} />
                            <RelativeTime ts={n.publishedAt} />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No recent political headlines found for this zone.</p>
                  )}
                </section>

                {report.nearbyEvents.length > 0 && (
                  <section className="sw-report-card">
                    <div style={{ ...sectionTitle, color: "#ef4444" }}>Nearby live events</div>
                    {report.nearbyEvents.map((ev) => (
                      <div key={ev.id} style={{ fontSize: 12, color: "#cbd5e1", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <strong style={{ color: LEVEL[ev.severity] ?? "#e2e8f0" }}>{ev.severity.toUpperCase()}</strong>
                        {" · "}
                        {ev.title}
                        <div style={{ color: "#64748b", marginTop: 3 }}>
                          {ev.distanceKm.toFixed(0)} km · <SourceBadge source={ev.source} />
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href={`/region?lat=${report.lat}&lng=${report.lng}`}
                style={ctaStyle}
              >
                Open region safety brief
              </Link>
              <Link href="/app" style={{ ...ctaStyle, borderColor: "rgba(255,255,255,0.12)", color: "#94a3b8" }}>
                Return to map
              </Link>
            </div>

            <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.55, margin: 0 }}>{report.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(160deg, #0a0e14 0%, #1a0a0e 40%, #0a0e14 100%)",
  color: "#e2e8f0",
  padding: "48px 24px 80px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
};

const backLinkStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: 1120,
  width: "100%",
  marginBottom: 24,
  color: "#64748b",
  fontSize: 13,
  textDecoration: "none",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "#22d3ee",
  fontWeight: 700,
  marginBottom: 14,
};

const ctaStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(239,68,68,0.35)",
  color: "#fca5a5",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
};
