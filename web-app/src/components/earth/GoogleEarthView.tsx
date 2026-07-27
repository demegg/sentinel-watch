"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Minus, Plus, Satellite, ExternalLink } from "lucide-react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import {
  clearGoogleMapsApiKey,
  earthWebUrl,
  getGoogleMapsApiKey,
  notifyGoogleKeyChange,
  setGoogleMapsApiKey,
  tiltForZoom,
  zoomToRange,
} from "@/lib/google-maps";
import { useSWStore } from "@/store/sw-store";
import LoadingState from "@/components/ui/LoadingState";

type Maps3DLib = google.maps.Maps3DLibrary;

export default function GoogleEarthView() {
  const focus = useSWStore((s) => s.focus);
  const mapCenter = useSWStore((s) => s.mapCenter);
  const earthZoom = useSWStore((s) => s.earthZoom);
  const setEarthZoom = useSWStore((s) => s.setEarthZoom);
  const events = useSWStore((s) => s.events);

  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [ready3d, setReady3d] = useState(false);
  const [error3d, setError3d] = useState<string | null>(null);
  const [loading3d, setLoading3d] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showKeyPanel, setShowKeyPanel] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const maps3dRef = useRef<Maps3DLib | null>(null);
  const skipFirstFly = useRef(true);

  useEffect(() => {
    const syncKey = () => {
      const key = getGoogleMapsApiKey();
      setApiKeyState(key);
      setShowKeyPanel(!key);
      setError3d(null);
      setReady3d(false);
    };
    syncKey();
    window.addEventListener("sw-google-key", syncKey);
    return () => window.removeEventListener("sw-google-key", syncKey);
  }, []);

  const center = useMemo(() => {
    if (focus) return { lat: focus.lat, lng: focus.lng };
    return { lat: mapCenter[0], lng: mapCenter[1] };
  }, [focus, mapCenter]);

  const label = focus
    ? `${focus.name}${focus.country ? `, ${focus.country}` : ""}`
    : "Google Earth 3D";

  const satelliteSrc = useMemo(() => {
    return `https://www.google.com/maps?ll=${center.lat},${center.lng}&z=${earthZoom}&t=k&hl=en&output=embed`;
  }, [center, earthZoom]);

  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [center.lat, center.lng, earthZoom]);

  const applyKey = useCallback((raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    setGoogleMapsApiKey(cleaned);
    notifyGoogleKeyChange();
    setApiKeyState(cleaned);
    setShowKeyPanel(false);
    setError3d(null);
    setReady3d(false);
  }, []);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    const host = containerRef.current;

    (async () => {
      setLoading3d(true);
      setError3d(null);
      try {
        setOptions({ key: apiKey, v: "weekly" });
        const lib = await importLibrary("maps3d");
        if (cancelled || !host) return;

        maps3dRef.current = lib;
        const { Map3DElement, MapMode } = lib;

        host.innerHTML = "";
        const map = new Map3DElement({
          center: { lat: center.lat, lng: center.lng, altitude: 0 },
          range: zoomToRange(earthZoom),
          tilt: tiltForZoom(earthZoom),
          heading: 0,
          mode: MapMode.HYBRID,
          gestureHandling: "GREEDY" as google.maps.maps3d.GestureHandlingString,
        });
        map.style.width = "100%";
        map.style.height = "100%";
        map.style.display = "block";
        host.appendChild(map);
        mapRef.current = map;
        skipFirstFly.current = true;
        setReady3d(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load Google Earth 3D";
        setError3d(
          msg.includes("ApiNotActivated") || msg.includes("ApiTargetBlocked")
            ? "Enable Maps JavaScript API (+ billing) for this key in Google Cloud."
            : msg
        );
        setReady3d(false);
        mapRef.current = null;
      } finally {
        if (!cancelled) setLoading3d(false);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      maps3dRef.current = null;
      if (host) host.innerHTML = "";
      setReady3d(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready3d) return;

    const endCamera = {
      center: { lat: center.lat, lng: center.lng, altitude: 0 },
      range: zoomToRange(earthZoom),
      tilt: tiltForZoom(earthZoom),
      heading: 0,
    };

    if (skipFirstFly.current) {
      skipFirstFly.current = false;
      map.center = endCamera.center;
      map.range = endCamera.range;
      map.tilt = endCamera.tilt;
      return;
    }

    try {
      map.flyCameraTo({ endCamera, durationMillis: 1600 });
    } catch {
      map.center = endCamera.center;
      map.range = endCamera.range;
      map.tilt = endCamera.tilt;
    }
  }, [center.lat, center.lng, earthZoom, ready3d]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = maps3dRef.current;
    if (!map || !lib || !ready3d) return;

    const existing = [...map.children].filter((c) =>
      c.tagName.toLowerCase().includes("marker")
    );
    existing.forEach((c) => c.remove());

    const pins: { lat: number; lng: number; label: string }[] = [];
    if (focus) pins.push({ lat: focus.lat, lng: focus.lng, label: focus.name });
    for (const e of events.filter((ev) => ev.distanceKm < 500).slice(0, 10)) {
      pins.push({ lat: e.lat, lng: e.lng, label: e.title.slice(0, 28) });
    }

    for (const p of pins) {
      try {
        const marker = new lib.Marker3DElement({
          position: { lat: p.lat, lng: p.lng, altitude: 0 },
          label: p.label,
        });
        map.append(marker);
      } catch { /* ignore */ }
    }
  }, [ready3d, focus, events]);

  const use3d = Boolean(apiKey) && ready3d && !error3d;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "#030303" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, display: use3d ? "block" : "none" }} />

      {!use3d && (
        <iframe
          key={iframeKey}
          title="Google Maps Satellite"
          src={satelliteSrc}
          style={{ width: "100%", height: "100%", border: 0 }}
          allow="geolocation; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      {(showKeyPanel || (!apiKey && !use3d)) && (
        <div
          style={{
            position: "absolute", left: "50%", top: 80, transform: "translateX(-50%)",
            zIndex: 20, width: "min(92vw, 420px)", pointerEvents: "auto",
            background: "rgba(10,14,20,0.92)", border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: 10, padding: 16, backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#22d3ee" }}>
            <KeyRound size={16} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", fontWeight: 600 }}>GOOGLE EARTH 3D</span>
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 10px" }}>
            Photorealistic 3D Earth requires a Google Maps API key with Maps JavaScript API enabled.
            Key is stored in this browser only.
          </p>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyKey(keyDraft)}
            placeholder="AIza…"
            style={{
              width: "100%", marginBottom: 8, padding: "8px 10px",
              background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6, color: "#e2e8f0", fontSize: 12, fontFamily: "monospace",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => applyKey(keyDraft)} style={btnStyle("#22d3ee")}>
              ACTIVATE
            </button>
            <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer" style={{ ...btnStyle("#64748b"), textDecoration: "none" }}>
              GET KEY
            </a>
            <button type="button" onClick={() => setShowKeyPanel(false)} style={btnStyle("#475569")}>
              SATELLITE ONLY
            </button>
          </div>
        </div>
      )}

      {loading3d && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          <LoadingState label="Loading Google Earth 3D…" sublabel="Photorealistic terrain & buildings" />
        </div>
      )}

      {error3d && apiKey && (
        <div style={{
          position: "absolute", left: "50%", top: 80, transform: "translateX(-50%)",
          zIndex: 20, width: "min(92vw, 400px)", padding: "10px 14px", textAlign: "center",
          background: "rgba(10,14,20,0.9)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8,
          pointerEvents: "auto",
        }}>
          <p style={{ fontSize: 11, color: "#fbbf24", margin: 0 }}>{error3d}</p>
          <button
            type="button"
            onClick={() => { clearGoogleMapsApiKey(); notifyGoogleKeyChange(); setApiKeyState(null); setShowKeyPanel(true); setError3d(null); }}
            style={{ marginTop: 6, fontSize: 10, color: "#22d3ee", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Change API key
          </button>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(10,14,20,0.85)", border: "1px solid rgba(34,211,238,0.25)",
          borderRadius: 8, padding: "6px 10px", backdropFilter: "blur(10px)",
        }}>
          <Satellite size={12} style={{ color: "#22d3ee" }} />
          <span style={{ fontSize: 10, color: "#94a3b8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label} · z{earthZoom}
          </span>
          <button type="button" aria-label="Zoom out" onClick={() => setEarthZoom(earthZoom - 1)} style={iconBtn}>
            <Minus size={12} />
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => setEarthZoom(Math.min(21, earthZoom + 1))} style={iconBtn}>
            <Plus size={12} />
          </button>
          <button type="button" onClick={() => setShowKeyPanel(true)} style={iconBtn} title="API key">
            <KeyRound size={12} />
          </button>
          <a href={earthWebUrl(center.lat, center.lng, earthZoom)} target="_blank" rel="noreferrer" style={iconBtn} title="Open Google Earth Web">
            <ExternalLink size={12} />
          </a>
        </div>
        <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>
          {use3d ? "Photorealistic 3D · drag to orbit" : "Satellite embed · add API key for full 3D"}
        </span>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4, padding: 4, color: "#94a3b8", cursor: "pointer", textDecoration: "none",
};

function btnStyle(color: string): React.CSSProperties {
  return {
    fontSize: 10, letterSpacing: "0.12em", padding: "6px 12px", cursor: "pointer",
    background: "transparent", border: `1px solid ${color}44`, borderRadius: 4, color,
  };
}
