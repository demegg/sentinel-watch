"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSWStore, type OverlayKey } from "@/store/sw-store";
import { Thermometer, CloudRain, Wind, Layers, ChevronDown } from "lucide-react";

const OPTIONS: { id: OverlayKey; label: string; icon: ReactNode; color: string }[] = [
  { id: "none", label: "Layers off", icon: <Layers size={12} />, color: "#64748b" },
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === overlay) ?? OPTIONS[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const activate = async (id: OverlayKey) => {
    setOverlay(id);
    setOpen(false);
    if (id === "precip") await ensureRadar();
  };

  return (
    <div className="sw-overlays sw-overlay-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="sw-view-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ color: current.color }}
      >
        {current.icon}
        <span className="sw-overlay-label">{current.label}</span>
        <ChevronDown size={12} style={{ opacity: 0.7, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="sw-view-dropdown-menu sw-overlay-dropdown-menu" role="listbox">
          {OPTIONS.map((o) => {
            const on = overlay === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`sw-view-dropdown-item${on ? " is-active" : ""}`}
                style={{ color: on ? o.color : undefined }}
                onClick={() => void activate(o.id)}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {overlay === "temp" && !open && (
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
      {overlay === "wind" && !open && (
        <Legend
          items={[
            ["#4ade80", "calm"],
            ["#facc15", "breeze"],
            ["#f97316", "strong"],
            ["#ef4444", "gale"],
          ]}
        />
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
