"use client";

import type { ReactNode } from "react";
import { Globe, Map } from "lucide-react";
import { useSWStore, type ViewMode } from "@/store/sw-store";

const MODES: { id: ViewMode; label: string; icon: ReactNode }[] = [
  { id: "map", label: "Sentinel Watch", icon: <Map size={12} /> },
  { id: "earth", label: "3D Earth", icon: <Globe size={12} /> },
];

export default function ViewModeControls() {
  const viewMode = useSWStore((s) => s.viewMode);
  const setViewMode = useSWStore((s) => s.setViewMode);

  return (
    <div className="sw-view-modes">
      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#475569", padding: "2px 6px" }}>
        VIEW MODE
      </div>
      {MODES.map((m) => {
        const on = viewMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setViewMode(m.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 5,
              cursor: "pointer",
              border: `1px solid ${on ? "rgba(34,211,238,0.45)" : "transparent"}`,
              background: on ? "rgba(34,211,238,0.12)" : "transparent",
              color: on ? "#22d3ee" : "#64748b",
              fontSize: 11,
              fontWeight: on ? 600 : 400,
            }}
          >
            {m.icon}
            <span className="sw-mode-label">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
