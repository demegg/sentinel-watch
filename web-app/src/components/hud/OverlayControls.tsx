"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Thermometer,
  CloudRain,
  Wind,
  Layers,
  ChevronDown,
  Plane,
  Crosshair,
  CloudLightning,
  Flame,
  Activity,
  Sparkles,
} from "lucide-react";
import { useSWStore, type OverlayKey, type LiveLayerKey } from "@/store/sw-store";

const CLIMATE: { id: OverlayKey; label: string; icon: ReactNode; color: string }[] = [
  { id: "none", label: "Climate off", icon: <Layers size={12} />, color: "#64748b" },
  { id: "temp", label: "Climate", icon: <Thermometer size={12} />, color: "#f97316" },
  { id: "precip", label: "Rain radar", icon: <CloudRain size={12} />, color: "#3b82f6" },
  { id: "wind", label: "Wind", icon: <Wind size={12} />, color: "#4ade80" },
];

const INTEL: {
  id: LiveLayerKey;
  label: string;
  icon: ReactNode;
  color: string;
  hint: string;
}[] = [
  { id: "planes", label: "Aircraft", icon: <Plane size={12} />, color: "#22d3ee", hint: "Live ADS-B" },
  { id: "combat", label: "Combat zones", icon: <Crosshair size={12} />, color: "#ef4444", hint: "Conflicts" },
  { id: "storms", label: "Storm catcher", icon: <CloudLightning size={12} />, color: "#38bdf8", hint: "Cyclones" },
  { id: "fires", label: "Fires / volcanoes", icon: <Flame size={12} />, color: "#f97316", hint: "EONET" },
  { id: "quakes", label: "Quake rings", icon: <Activity size={12} />, color: "#ff3355", hint: "USGS" },
  { id: "space", label: "Space weather", icon: <Sparkles size={12} />, color: "#c084fc", hint: "NOAA" },
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
  const liveLayers = useSWStore((s) => s.liveLayers);
  const toggleLiveLayer = useSWStore((s) => s.toggleLiveLayer);
  const [open, setOpen] = useState(false);
  const [spaceHud, setSpaceHud] = useState<{
    kp: number;
    level: string;
    summary: string;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeIntel = INTEL.filter((l) => liveLayers[l.id]).length;
  const climate = CLIMATE.find((o) => o.id === overlay) ?? CLIMATE[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!liveLayers.space) {
      setSpaceHud(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/space");
        const data = await res.json();
        if (!cancelled && !data.error) {
          setSpaceHud({ kp: data.kp, level: data.level, summary: data.summary });
        }
      } catch {
        if (!cancelled) setSpaceHud(null);
      }
    };
    void load();
    const id = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [liveLayers.space]);

  const activateClimate = async (id: OverlayKey) => {
    setOverlay(id);
    if (id === "precip") await ensureRadar();
  };

  return (
    <div className="sw-overlays sw-overlay-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="sw-view-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ color: activeIntel > 0 ? "#22d3ee" : climate.color }}
      >
        <Layers size={12} />
        <span className="sw-overlay-label">
          Earth layers{activeIntel > 0 ? ` · ${activeIntel}` : ""}
        </span>
        <ChevronDown
          size={12}
          style={{
            opacity: 0.7,
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform .15s",
          }}
        />
      </button>

      {open && (
        <div className="sw-view-dropdown-menu sw-overlay-dropdown-menu sw-layers-menu" role="menu">
          <div className="sw-layers-section-title">Atmosphere</div>
          {CLIMATE.map((o) => {
            const on = overlay === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={`sw-view-dropdown-item${on ? " is-active" : ""}`}
                style={{ color: on ? o.color : undefined }}
                onClick={() => void activateClimate(o.id)}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            );
          })}

          <div className="sw-layers-section-title">Earth watch</div>
          {INTEL.map((o) => {
            const on = liveLayers[o.id];
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                className={`sw-view-dropdown-item sw-layers-toggle${on ? " is-active" : ""}`}
                style={{ color: on ? o.color : undefined }}
                onClick={() => toggleLiveLayer(o.id)}
              >
                {o.icon}
                <span className="sw-layers-toggle-label">
                  {o.label}
                  <em>{o.hint}</em>
                </span>
                <span className={`sw-layers-check${on ? " is-on" : ""}`} aria-hidden />
              </button>
            );
          })}
        </div>
      )}

      {!open && overlay === "temp" && (
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
      {!open && overlay === "wind" && (
        <Legend
          items={[
            ["#4ade80", "calm"],
            ["#facc15", "breeze"],
            ["#f97316", "strong"],
            ["#ef4444", "gale"],
          ]}
        />
      )}

      {!open && activeIntel > 0 && (
        <div className="sw-layers-active-pills">
          {INTEL.filter((l) => liveLayers[l.id]).map((l) => (
            <span key={l.id} style={{ color: l.color }}>
              {l.label}
            </span>
          ))}
        </div>
      )}

      {!open && spaceHud && (
        <div className="sw-space-chip-inner">
          <span className="sw-space-chip-label">SPACE</span>
          <strong>Kp {spaceHud.kp.toFixed(1)}</strong>
          <span>{spaceHud.level}</span>
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
