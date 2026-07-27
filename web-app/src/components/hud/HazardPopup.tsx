"use client";

import Link from "next/link";
import { useSWStore } from "@/store/sw-store";
import { X, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { severityColor } from "@/lib/data";
import LoadingState from "@/components/ui/LoadingState";

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
  other: "#94a3b8",
};

const LEVEL_COLOR = {
  low: "#4ade80",
  moderate: "#facc15",
  high: "#f97316",
  critical: "#ef4444",
} as const;

export default function HazardPopup() {
  const hazard = useSWStore((s) => s.hazard);
  const hazardLoading = useSWStore((s) => s.hazardLoading);
  const setHazard = useSWStore((s) => s.setHazard);
  const setSelectedEvent = useSWStore((s) => s.setSelectedEvent);
  const setMapView = useSWStore((s) => s.setMapView);

  if (!hazard && !hazardLoading) return null;

  const reportUrl =
    hazard && Number.isFinite(hazard.lat) && Number.isFinite(hazard.lng)
      ? `/region?lat=${hazard.lat}&lng=${hazard.lng}`
      : null;

  return (
    <div className="sw-hazard-popup">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ShieldAlert size={14} style={{ color: "#f97316" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.25em", color: "#f97316" }}>
            REGION AWARENESS
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e2e8f0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hazardLoading ? "Scanning area…" : hazard?.placeName}
            {hazard?.country ? `, ${hazard.country}` : ""}
          </div>
        </div>
        <button
          onClick={() => setHazard(null)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            padding: 4,
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "10px 12px", flex: 1 }}>
        {hazardLoading && (
          <LoadingState
            compact
            label="Loading region awareness…"
            sublabel="Checking wildlife, crime, conflict, weather & tourist risks"
          />
        )}

        {!hazardLoading && hazard && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
              {hazard.summary}
            </p>

            {hazard.hazards.slice(0, 6).map((h) => (
              <div
                key={h.id}
                style={{
                  borderLeft: `3px solid ${LEVEL_COLOR[h.level]}`,
                  background: "rgba(255,255,255,0.02)",
                  padding: "8px 10px",
                  marginBottom: 6,
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      color: CAT_COLOR[h.category] ?? "#94a3b8",
                      textTransform: "uppercase",
                    }}
                  >
                    {h.category}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: LEVEL_COLOR[h.level],
                      textTransform: "uppercase",
                    }}
                  >
                    {h.level}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{h.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, marginTop: 2 }}>
                  {h.detail}
                </div>
              </div>
            ))}

            {hazard.hazards.length > 6 && (
              <p style={{ margin: "0 0 8px", fontSize: 10, color: "#475569" }}>
                +{hazard.hazards.length - 6} more advisories in full report
              </p>
            )}

            {hazard.nearbyEvents.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "#ef4444",
                    marginBottom: 6,
                  }}
                >
                  <AlertTriangle size={11} /> NEARBY LIVE EVENTS
                </div>
                {hazard.nearbyEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      setSelectedEvent(ev);
                      setMapView([ev.lat, ev.lng], 10);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      padding: "6px 0",
                      cursor: "pointer",
                      color: "#e2e8f0",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: severityColor(ev.severity), fontWeight: 700 }}>
                      {ev.severity.toUpperCase()}
                    </span>{" "}
                    · {ev.title}
                    <span style={{ color: "#475569" }}> · {ev.distanceKm.toFixed(0)} km</span>
                  </button>
                ))}
              </div>
            )}

            {reportUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <Link
                  href={reportUrl}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "rgba(249,115,22,0.12)",
                    border: "1px solid rgba(249,115,22,0.35)",
                    borderRadius: 6,
                    color: "#fb923c",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textDecoration: "none",
                    textTransform: "uppercase",
                  }}
                >
                  View full region report
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            <p style={{ margin: "10px 0 0", fontSize: 9, color: "#334155", lineHeight: 1.4 }}>
              General situational awareness only — not official travel advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
