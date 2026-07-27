"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { climateZone, windDirLabel } from "@/lib/climate-utils";
import type { RegionalEvent } from "@/lib/data";
import type { HazardCategory, RegionHazard } from "@/lib/region-advisories";
import LoadingState from "@/components/ui/LoadingState";

type HazardSection = {
  category: HazardCategory;
  label: string;
  hazards: RegionHazard[];
};

type HazardReport = {
  placeName: string;
  country: string;
  region?: string;
  summary: string;
  hazards: RegionHazard[];
  avoidList: string[];
  sections?: HazardSection[];
  nearbyEvents: RegionalEvent[];
  totalAdvisories: number;
  disclaimer: string;
};

type WeatherData = {
  city: string;
  country: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    condition: string;
  };
};

const LEVEL_COLOR: Record<string, string> = {
  low: "#4ade80",
  moderate: "#facc15",
  high: "#f97316",
  critical: "#ef4444",
};

const CAT_COLOR: Record<string, string> = {
  wildlife: "#f97316",
  venom: "#a855f7",
  crime: "#facc15",
  conflict: "#ef4444",
  terror: "#dc2626",
  health: "#22d3ee",
  weather: "#3b82f6",
  transport: "#94a3b8",
  cultural: "#c084fc",
  other: "#64748b",
};

export default function RegionPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="sw-region-page" style={pageStyle}>
          <LoadingState label="Loading region report…" sublabel="Preparing tourist safety brief" />
        </div>
      }
    >
      <RegionPage />
    </Suspense>
  );
}

function RegionPage() {
  const searchParams = useSearchParams();
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  const [loadingStep, setLoadingStep] = useState("Identifying location…");
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [report, setReport] = useState<HazardReport | null>(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadingStep("Identifying location…");

    const load = async () => {
      try {
        setLoadingStep("Fetching weather & climate…");
        const wxPromise = fetch(`/api/weather?lat=${lat}&lng=${lng}`).then((r) => r.json());

        setLoadingStep("Building tourist safety report…");
        const hzPromise = fetch(`/api/hazards?lat=${lat}&lng=${lng}&full=1`).then((r) => r.json());

        const [wx, hz] = await Promise.all([wxPromise, hzPromise]);
        if (cancelled) return;

        if (!wx.error) setWeather(wx);
        if (!hz.error) setReport(hz);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="sw-region-page" style={pageStyle}>
        <Link href="/app" style={backLinkStyle}>← Back to map</Link>
        <p style={{ color: "#94a3b8" }}>Invalid coordinates.</p>
      </div>
    );
  }

  const temp = weather?.current?.temperature_2m;
  const zone = temp != null ? climateZone(temp) : "—";
  const placeName = report?.placeName ?? `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  const country = report?.country ?? weather?.country ?? "";
  const sections = report?.sections ?? [];

  return (
    <div className="sw-region-page" style={pageStyle}>
      <Link href="/app" style={backLinkStyle}>← Back to map</Link>

      <div style={{ maxWidth: 760, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        <header>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#f97316", marginBottom: 8 }}>
            TOURIST REGION REPORT
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>
            {placeName}
            {country ? `, ${country}` : ""}
          </h1>
          {report?.region && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{report.region}</div>
          )}
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            {lat.toFixed(4)}°, {lng.toFixed(4)}°
          </div>
        </header>

        {loading ? (
          <div style={cardStyle}>
            <LoadingState label="Compiling region report…" sublabel={loadingStep} />
          </div>
        ) : (
          <>
            {report && (
              <section style={{ ...cardStyle, borderColor: "rgba(249,115,22,0.25)" }}>
                <div style={sectionTitle}>Visitor overview</div>
                <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 12px" }}>
                  {report.summary}
                </p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
                  <span><strong style={{ color: "#e2e8f0" }}>{report.totalAdvisories}</strong> advisories</span>
                  <span><strong style={{ color: "#ef4444" }}>{report.hazards.filter((h) => h.level === "critical" || h.level === "high").length}</strong> high priority</span>
                  <span><strong style={{ color: "#f97316" }}>{report.avoidList.length}</strong> things to avoid</span>
                </div>
              </section>
            )}

            {report && report.avoidList.length > 0 && (
              <section style={{ ...cardStyle, borderColor: "rgba(239,68,68,0.3)" }}>
                <div style={{ ...sectionTitle, color: "#ef4444" }}>Things tourists should avoid</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {report.avoidList.map((item) => (
                    <li key={item} style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {weather?.current && (
              <section style={cardStyle}>
                <div style={sectionTitle}>Weather &amp; climate</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
                  <Stat label="Temperature" value={`${weather.current.temperature_2m.toFixed(1)}°C`} accent="#f97316" />
                  <Stat label="Conditions" value={weather.current.condition} />
                  <Stat label="Humidity" value={`${weather.current.relative_humidity_2m}%`} />
                  <Stat label="Wind" value={`${weather.current.wind_speed_10m} km/h ${windDirLabel(weather.current.wind_direction_10m)}`} accent="#4ade80" />
                  <Stat label="Climate zone" value={zone} accent="#22d3ee" />
                </div>
              </section>
            )}

            {sections.map((section) => (
              <section key={section.category} style={cardStyle}>
                <div style={sectionTitle}>
                  {section.label}
                  <span style={{ color: "#475569", fontWeight: 400, marginLeft: 8 }}>({section.hazards.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {section.hazards.map((h) => (
                    <HazardCard key={h.id} hazard={h} />
                  ))}
                </div>
              </section>
            ))}

            {report && !sections.length && (
              <section style={cardStyle}>
                <div style={sectionTitle}>Advisories</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {report.hazards.map((h) => (
                    <HazardCard key={h.id} hazard={h} />
                  ))}
                </div>
              </section>
            )}

            {report?.nearbyEvents?.length ? (
              <section style={cardStyle}>
                <div style={{ ...sectionTitle, color: "#ef4444" }}>Live nearby events</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {report.nearbyEvents.map((ev) => (
                    <div key={ev.id} style={{ fontSize: 12, color: "#cbd5e1", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <strong style={{ color: LEVEL_COLOR[ev.severity] ?? "#e2e8f0" }}>{ev.severity.toUpperCase()}</strong>
                      {" · "}
                      <strong style={{ color: "#e2e8f0" }}>{ev.title}</strong>
                      <div style={{ color: "#64748b", marginTop: 2 }}>
                        {ev.kind} · {ev.distanceKm.toFixed(0)} km · {ev.source}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {report?.disclaimer && (
              <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                {report.disclaimer}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HazardCard({ hazard: h }: { hazard: RegionHazard }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${LEVEL_COLOR[h.level] ?? "#475569"}33`,
        borderLeft: `3px solid ${LEVEL_COLOR[h.level] ?? "#475569"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{h.title}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {h.avoid && (
            <span style={{ fontSize: 8, letterSpacing: "0.1em", color: "#ef4444", fontWeight: 700 }}>AVOID</span>
          )}
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: LEVEL_COLOR[h.level] ?? "#94a3b8",
              fontWeight: 700,
            }}
          >
            {h.level}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>{h.detail}</div>
      <div style={{ fontSize: 10, color: CAT_COLOR[h.category] ?? "#475569", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {h.category}
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
  background: "linear-gradient(160deg, #0a0e14 0%, #0f172a 50%, #0a0e14 100%)",
  color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, sans-serif",
  padding: "48px 24px 80px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
};

const backLinkStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: 760,
  width: "100%",
  marginBottom: 24,
  color: "#64748b",
  fontSize: 13,
  textDecoration: "none",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(17,24,39,0.85)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "20px 22px",
  backdropFilter: "blur(12px)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "#22d3ee",
  fontWeight: 700,
  marginBottom: 14,
};
