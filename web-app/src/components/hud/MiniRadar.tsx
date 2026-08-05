"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useSWStore } from "@/store/sw-store";

/**
 * Compact live radar HUD — RainViewer frame + sweep for command-center vibe.
 * Click toggles full-map rain overlay.
 */
export default function MiniRadar() {
  const overlay = useSWStore((s) => s.overlay);
  const setOverlay = useSWStore((s) => s.setOverlay);
  const radarPath = useSWStore((s) => s.radarPath);
  const setRadarPath = useSWStore((s) => s.setRadarPath);
  const mapCenter = useSWStore((s) => s.mapCenter);
  const [time, setTime] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/radar");
        const data = await res.json();
        if (cancelled) return;
        if (data.path) setRadarPath(data.path);
        if (data.time) setTime(data.time);
      } catch {
        /* keep previous */
      }
    };
    void load();
    const id = window.setInterval(load, 180_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setRadarPath]);

  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => p + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const active = overlay === "precip";
  // Approximate tile for current map center at low zoom for the inset preview
  const z = 3;
  const lat = mapCenter[0];
  const lng = mapCenter[1];
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  const tileUrl =
    radarPath != null
      ? `https://tilecache.rainviewer.com${radarPath}/256/${z}/${x}/${y}/2/1_1.png`
      : null;

  const sweepDeg = (pulse * 6) % 360;

  const toggle = () => {
    if (active) setOverlay("none");
    else {
      setOverlay("precip");
      if (!radarPath) {
        void fetch("/api/radar")
          .then((r) => r.json())
          .then((d) => {
            if (d.path) setRadarPath(d.path);
            if (d.time) setTime(d.time);
          })
          .catch(() => undefined);
      }
    }
  };

  return (
    <button
      type="button"
      className={`sw-mini-radar${active ? " is-active" : ""}`}
      onClick={toggle}
      title={active ? "Hide rain radar overlay" : "Show rain radar on map"}
      aria-pressed={active}
    >
      <div className="sw-mini-radar-scope" aria-hidden>
        {tileUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tileUrl} alt="" className="sw-mini-radar-tile" />
        )}
        <div
          className="sw-mini-radar-sweep"
          style={{ transform: `rotate(${sweepDeg}deg)` }}
        />
        <div className="sw-mini-radar-ring" />
        <div className="sw-mini-radar-cross" />
        <span className="sw-mini-radar-blip" />
      </div>
      <div className="sw-mini-radar-meta">
        <span className="sw-mini-radar-live">
          <Radio size={10} /> LIVE
        </span>
        <span className="sw-mini-radar-title">Radar</span>
        <span className="sw-mini-radar-sub">
          {time
            ? new Date(time * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "RainViewer"}
        </span>
      </div>
    </button>
  );
}
