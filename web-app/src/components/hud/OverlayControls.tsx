"use client";

import { useSWStore, type OverlayKey } from "@/store/sw-store";
import { Thermometer, CloudRain, Wind, Layers } from "lucide-react";
import type { ReactNode } from "react";

const OPTIONS: { id: OverlayKey; label: string; icon: ReactNode; color: string }[] = [
  { id: "none", label: "Off", icon: <Layers size={12} />, color: "#64748b" },
  { id: "temp", label: "Climate", icon: <Thermometer size={12} />, color: "#f97316" },
  { id: "precip", label: "Rain", icon: <CloudRain size={12} />, color: "#3b82f6" },
  { id: "wind", label: "Wind", icon: <Wind size={12} />, color: "#4ade80" },
];

async function ensureRadar() {
  const { setRadarPath } = useSWStore.getState();
  try {
    const res = await fetch("/api/radar");
    const data = await res.json();
    setRadarPath(data.path ?? null);
  } catch {
    setRadarPath(null);
  }
}

export default function OverlayControls() {
  const overlay = useSWStore((s) => s.overlay);
  const setOverlay = useSWStore((s) => s.setOverlay);

  const activate = async (id: OverlayKey) => {
    setOverlay(id);
    if (id === "precip") await ensureRadar();
    // Climate/wind loads from visible map bounds via ClimateOverlayLoader
  };

  return (
    <div className="sw-overlays">
      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#475569", padding: "2px 6px" }}>
        LIVE LAYERS
      </div>
      {OPTIONS.map((o) => {
        const on = overlay === o.id;
        return (
          <button
            key={o.id}
            onClick={() => void activate(o.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 5,
              cursor: "pointer",
              border: `1px solid ${on ? o.color + "66" : "transparent"}`,
              background: on ? `${o.color}18` : "transparent",
              color: on ? o.color : "#64748b",
              fontSize: 11,
              fontWeight: on ? 600 : 400,
            }}
          >
            {o.icon}
            <span className="sw-overlay-label">{o.label}</span>
          </button>
        );
      })}

      {overlay === "temp" && (
        <Legend
          items={[
            ["#3b82f6", "cold"],
            ["#4ade80", "mild"],
            ["#facc15", "warm"],
            ["#f97316", "hot"],
            ["#ef4444", "extreme"],
          ]}
        />
      )}
      {overlay === "wind" && (
        <Legend
          items={[
            ["#4ade80", "calm"],
            ["#facc15", "breeze"],
            ["#f97316", "strong"],
            ["#ef4444", "gale"],
          ]}
        />
      )}
      {overlay === "precip" && (
        <div style={{ fontSize: 9, color: "#475569", padding: "2px 6px", maxWidth: 90 }}>
          Live radar
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "4px 6px" }}>
      {items.map(([c, l]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#94a3b8" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
          {l}
        </div>
      ))}
    </div>
  );
}
