"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoadingState from "@/components/ui/LoadingState";
import TrustBar, { SourceBadge } from "@/components/ui/TrustBar";
import RelativeTime from "@/components/ui/RelativeTime";
import RiskBadge from "@/components/ui/RiskBadge";
import ShareBrief from "@/components/ui/ShareBrief";
import type { RiskScore } from "@/lib/risk-score";

type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
};

type StormReport = {
  title: string;
  kind: string;
  severity: string;
  lat: number;
  lng: number;
  source: string;
  summary: string;
  verified?: boolean;
  guidance: string[];
  conditions: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    precipitation?: number;
  } | null;
  outlook: { dates: string[]; precip: number[]; windMax: number[] } | null;
  news: NewsItem[];
  sources: string[];
  risk?: RiskScore;
  fetchedAt: number;
  disclaimer: string;
};

const LEVEL: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#38bdf8",
  low: "#4ade80",
};

export default function StormPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="sw-region-page" style={pageStyle}>
          <LoadingState label="Loading storm report…" />
        </div>
      }
    >
      <StormPage />
    </Suspense>
  );
}

function StormPage() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<StormReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/storm-report?${sp.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setReport(null);
        } else setReport(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load storm report.");
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
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#38bdf8", marginBottom: 8 }}>
              STORM REPORT
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>
              {report?.title ?? (loading ? "Loading…" : "Storm")}
            </h1>
            {report && (
              <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
                <span style={{ color: LEVEL[report.severity] ?? "#38bdf8", fontWeight: 700, letterSpacing: "0.1em" }}>
                  {report.severity.toUpperCase()}
                </span>
                <span>{report.kind}</span>
                <span>{report.source}</span>
                <span>
                  {report.lat.toFixed(3)}°, {report.lng.toFixed(3)}°
                </span>
                <span style={{ color: report.verified ? "#4ade80" : "#facc15", fontWeight: 600 }}>
                  {report.verified ? "Feed-verified" : "Unverified location"}
                </span>
              </div>
            )}
          </div>
          {report && (
            <ShareBrief title={`Storm report · ${report.title}`} text={report.summary} />
          )}
        </header>

        {loading && (
          <div className="sw-report-card">
            <LoadingState label="Compiling storm report…" sublabel="Track, local weather, safety guidance" />
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
                <section className="sw-report-card" style={{ borderColor: "rgba(56,189,248,0.3)" }}>
                  <div style={sectionTitle}>System overview</div>
                  <p style={{ margin: 0, fontSize: 14, color: "#cbd5e1", lineHeight: 1.65 }}>{report.summary}</p>
                </section>

                {report.conditions && (
                  <section className="sw-report-card">
                    <div style={sectionTitle}>Conditions at center</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
                      {report.conditions.temperature_2m != null && (
                        <Stat label="Temp" value={`${report.conditions.temperature_2m}°C`} />
                      )}
                      {report.conditions.wind_speed_10m != null && (
                        <Stat label="Wind" value={`${report.conditions.wind_speed_10m} km/h`} accent="#38bdf8" />
                      )}
                      {report.conditions.wind_gusts_10m != null && (
                        <Stat label="Gusts" value={`${report.conditions.wind_gusts_10m} km/h`} accent="#f97316" />
                      )}
                      {report.conditions.precipitation != null && (
                        <Stat label="Precip" value={`${report.conditions.precipitation} mm`} accent="#3b82f6" />
                      )}
                    </div>
                  </section>
                )}

                {report.outlook?.dates?.length ? (
                  <section className="sw-report-card">
                    <div style={sectionTitle}>3-day outlook</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {report.outlook.dates.map((d, i) => (
                        <div
                          key={d}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            fontSize: 13,
                            color: "#cbd5e1",
                            padding: "8px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <span>{d}</span>
                          <span style={{ color: "#64748b" }}>
                            rain {report.outlook?.precip[i] ?? "—"} mm · wind max{" "}
                            {report.outlook?.windMax[i] ?? "—"} km/h
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="sw-report-stack">
                <section className="sw-report-card">
                  <div style={{ ...sectionTitle, color: "#f97316" }}>Safety guidance</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.guidance.map((g) => (
                      <li key={g} style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>
                        {g}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="sw-report-card">
                  <div style={{ ...sectionTitle, color: "#a855f7" }}>Storm & regional news</div>
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
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No recent storm headlines found.</p>
                  )}
                </section>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/region?lat=${report.lat}&lng=${report.lng}`} style={ctaStyle}>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: accent ?? "#e2e8f0" }}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(160deg, #0a0e14 0%, #0a1520 45%, #0a0e14 100%)",
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
  border: "1px solid rgba(56,189,248,0.35)",
  color: "#7dd3fc",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
};
