"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useSWStore } from "@/store/sw-store";
import { haversineKm, type RegionalEvent } from "@/lib/data";
import { projectCourse, type PlaneState } from "@/lib/aircraft";
import RelativeTime from "@/components/ui/RelativeTime";

type CombatZone = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceKm: number;
  radiusKm: number;
  severity: "high" | "critical";
  source: string;
  url?: string;
};

type SpaceSnap = {
  kp: number;
  level: string;
  auroraLikely: boolean;
};

const planeIconCache = new Map<string, L.DivIcon>();

function getPlaneIcon(heading: number | null, onGround: boolean, selected = false) {
  const bucket = Math.round(((heading ?? 0) % 360) / 20) * 20;
  const key = `${bucket}-${onGround ? "g" : "a"}-${selected ? "s" : "n"}`;
  const cached = planeIconCache.get(key);
  if (cached) return cached;

  const color = selected ? "#fbbf24" : onGround ? "#94a3b8" : "#22d3ee";
  const icon = L.divIcon({
    className: `sw-plane-icon${selected ? " is-selected" : ""}`,
    html: `<div class="sw-plane-rot" style="--hdg:${bucket}deg;--pc:${color}">
      <svg viewBox="0 0 24 24" width="${selected ? 22 : 17}" height="${selected ? 22 : 17}" aria-hidden="true">
        <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z"/>
      </svg>
    </div>`,
    iconSize: selected ? [28, 28] : [20, 20],
    iconAnchor: selected ? [14, 14] : [10, 10],
  });
  planeIconCache.set(key, icon);
  return icon;
}

function expandBBox(bounds: L.LatLngBounds, zoom: number) {
  const pad = 0.05;
  let lamin = bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * pad;
  let lamax = bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * pad;
  let lomin = bounds.getWest() - (bounds.getEast() - bounds.getWest()) * pad;
  let lomax = bounds.getEast() + (bounds.getEast() - bounds.getWest()) * pad;
  lamin = Math.max(-85, lamin);
  lamax = Math.min(85, lamax);
  if (lomax < lomin) {
    lomin = bounds.getWest();
    lomax = bounds.getEast();
  }
  lomin = Math.max(-179.5, lomin);
  lomax = Math.min(179.5, lomax);

  const maxLat = zoom < 5 ? 18 : zoom < 7 ? 28 : 38;
  const maxLng = zoom < 5 ? 28 : zoom < 7 ? 42 : 58;
  if (lamax - lamin > maxLat) {
    const mid = (lamax + lamin) / 2;
    lamin = mid - maxLat / 2;
    lamax = mid + maxLat / 2;
  }
  if (lomax - lomin > maxLng) {
    const mid = (lomax + lomin) / 2;
    lomin = mid - maxLng / 2;
    lomax = mid + maxLng / 2;
  }
  return { lamin, lomin, lamax, lomax };
}

function conflictHref(z: CombatZone) {
  const q = new URLSearchParams({
    id: z.id,
    lat: String(z.lat),
    lng: String(z.lng),
  });
  return `/conflict?${q.toString()}`;
}

function stormHref(s: RegionalEvent) {
  const q = new URLSearchParams({
    id: s.id,
    lat: String(s.lat),
    lng: String(s.lng),
  });
  return `/storm?${q.toString()}`;
}

export default function LiveMapLayers() {
  const map = useMap();
  const liveLayers = useSWStore((s) => s.liveLayers);
  const events = useSWStore((s) => s.events);
  const planes = useSWStore((s) => s.aircraft);
  const setAircraft = useSWStore((s) => s.setAircraft);
  const selectedAircraftId = useSWStore((s) => s.selectedAircraftId);
  const selectAircraft = useSWStore((s) => s.selectAircraft);
  const aircraftTrails = useSWStore((s) => s.aircraftTrails);

  const [storms, setStorms] = useState<RegionalEvent[]>([]);
  const [fires, setFires] = useState<RegionalEvent[]>([]);
  const [combat, setCombat] = useState<CombatZone[]>([]);
  const [space, setSpace] = useState<SpaceSnap | null>(null);
  const [tick, setTick] = useState(0);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const anyIntel =
    liveLayers.planes ||
    liveLayers.combat ||
    liveLayers.storms ||
    liveLayers.fires ||
    liveLayers.quakes ||
    liveLayers.space;

  const bump = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setZoom(map.getZoom());
      setTick((t) => t + 1);
    }, 350);
  }, [map]);

  useMapEvents({
    moveend: bump,
    zoomend: bump,
  });

  useEffect(() => {
    if (!anyIntel) return;
    setTick((t) => t + 1);
  }, [
    liveLayers.planes,
    liveLayers.combat,
    liveLayers.storms,
    liveLayers.fires,
    liveLayers.quakes,
    liveLayers.space,
    anyIntel,
  ]);

  useEffect(() => {
    if (!anyIntel) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 40000);
    return () => window.clearInterval(id);
  }, [anyIntel]);

  useEffect(() => {
    if (!liveLayers.planes) {
      setAircraft([], Date.now(), null);
      selectAircraft(null);
      return;
    }
    if (zoom < 4) {
      setAircraft([], Date.now(), "Zoom in to level 4 or closer to scan local airspace.");
      return;
    }
    let cancelled = false;
    const run = async () => {
      const { lamin, lomin, lamax, lomax } = expandBBox(map.getBounds(), zoom);
      try {
        const res = await fetch(
          `/api/planes?lamin=${lamin.toFixed(3)}&lomin=${lomin.toFixed(3)}&lamax=${lamax.toFixed(3)}&lomax=${lomax.toFixed(3)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setAircraft([], Date.now(), data.error);
          return;
        }
        const list: PlaneState[] = (data.planes ?? [])
          .filter((p: PlaneState) => !p.onGround)
          .slice(0, zoom < 6 ? 60 : 120);
        setAircraft(list, data.fetchedAt ?? Date.now(), null);
      } catch {
        if (!cancelled) setAircraft([], Date.now(), "Aircraft feed unavailable.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveLayers.planes, tick, map, zoom, setAircraft, selectAircraft]);

  useEffect(() => {
    if (!liveLayers.storms) {
      setStorms([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const c = map.getCenter();
      try {
        const res = await fetch(`/api/storms?lat=${c.lat}&lng=${c.lng}&radius=12000`);
        const data = await res.json();
        if (!cancelled) setStorms(data.storms ?? []);
      } catch {
        if (!cancelled) setStorms([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveLayers.storms, tick, map]);

  useEffect(() => {
    if (!liveLayers.fires) {
      setFires([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const c = map.getCenter();
      try {
        const res = await fetch(`/api/fires?lat=${c.lat}&lng=${c.lng}&radius=12000`);
        const data = await res.json();
        if (!cancelled) setFires(data.fires ?? []);
      } catch {
        if (!cancelled) setFires([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveLayers.fires, tick, map]);

  useEffect(() => {
    if (!liveLayers.combat) {
      setCombat([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const c = map.getCenter();
      try {
        const res = await fetch(`/api/combat?lat=${c.lat}&lng=${c.lng}&radius=20000`);
        const data = await res.json();
        if (!cancelled) setCombat(data.zones ?? []);
      } catch {
        if (!cancelled) setCombat([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveLayers.combat, tick, map]);

  useEffect(() => {
    if (!liveLayers.space) {
      setSpace(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/space");
        const data = await res.json();
        if (!cancelled && !data.error) setSpace(data);
      } catch {
        if (!cancelled) setSpace(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveLayers.space, tick]);

  const quakes = useMemo(
    () =>
      liveLayers.quakes
        ? events.filter((e) => e.kind === "earthquake").slice(0, 40)
        : [],
    [liveLayers.quakes, events]
  );

  const selectedAircraft = useMemo(
    () => planes.find((plane) => plane.id === selectedAircraftId) ?? null,
    [planes, selectedAircraftId]
  );

  const selectedThreat = useMemo(() => {
    if (!selectedAircraft || !events.length) return null;
    let nearest: { event: RegionalEvent; distanceKm: number } | null = null;
    for (const event of events) {
      const distanceKm = haversineKm(selectedAircraft.lat, selectedAircraft.lng, event.lat, event.lng);
      if (!nearest || distanceKm < nearest.distanceKm) nearest = { event, distanceKm };
    }
    return nearest && nearest.distanceKm <= 500 ? nearest : null;
  }, [selectedAircraft, events]);

  const selectedTrail = selectedAircraftId ? aircraftTrails[selectedAircraftId] ?? [] : [];

  const ghostCourse = useMemo(() => {
    if (!selectedAircraft || selectedAircraft.heading == null || selectedAircraft.onGround) return null;
    const tip = projectCourse(
      selectedAircraft.lat,
      selectedAircraft.lng,
      selectedAircraft.heading,
      Math.max(40, Math.min(220, (selectedAircraft.velocityKts ?? 400) * 0.35))
    );
    return [
      [selectedAircraft.lat, selectedAircraft.lng] as [number, number],
      [tip.lat, tip.lng] as [number, number],
    ];
  }, [selectedAircraft]);

  return (
    <>
      {liveLayers.combat &&
        combat.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={Math.max(40_000, z.radiusKm * 1000)}
            pathOptions={{
              color: z.severity === "critical" ? "#ef4444" : "#f97316",
              fillColor: "#ef4444",
              fillOpacity: 0.14,
              weight: 2,
              dashArray: "8 6",
              opacity: 0.85,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: "#b91c1c" }}>COMBAT ZONE</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{z.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {z.source} · ~{z.radiusKm} km · approximate
                </div>
                <a
                  href={conflictHref(z)}
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fecaca",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    textDecoration: "none",
                  }}
                >
                  Open conflict report →
                </a>
              </div>
            </Popup>
          </Circle>
        ))}

      {liveLayers.combat &&
        combat.map((z) => (
          <CircleMarker
            key={`cz-dot-${z.id}`}
            center={[z.lat, z.lng]}
            radius={6}
            pathOptions={{
              color: "#fff",
              fillColor: "#ef4444",
              fillOpacity: 1,
              weight: 1.5,
            }}
          />
        ))}

      {liveLayers.storms &&
        storms.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.severity === "critical" ? 14 : 11}
            pathOptions={{
              color: "#e0f2fe",
              fillColor: "#0ea5e9",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: "#0284c7" }}>STORM CATCHER</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{s.detail}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {s.source} · <RelativeTime ts={s.timestamp} />
                </div>
                <a
                  href={stormHref(s)}
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#bae6fd",
                    background: "rgba(14,165,233,0.15)",
                    border: "1px solid rgba(14,165,233,0.4)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    textDecoration: "none",
                  }}
                >
                  Open storm report →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {liveLayers.storms &&
        storms.map((s) => (
          <Circle
            key={`storm-halo-${s.id}`}
            center={[s.lat, s.lng]}
            radius={s.severity === "critical" ? 280000 : 160000}
            pathOptions={{
              color: "#38bdf8",
              fillColor: "#0ea5e9",
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.5,
            }}
          />
        ))}

      {liveLayers.fires &&
        fires.map((f) => (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={9}
            pathOptions={{
              color: "#ffedd5",
              fillColor: f.kind === "volcano" ? "#ef4444" : "#f97316",
              fillOpacity: 0.95,
              weight: 1.5,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 180 }}>
                <div style={{ fontWeight: 700, color: "#ea580c" }}>
                  {f.kind === "volcano" ? "VOLCANO" : "WILDFIRE"}
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {f.source} · <RelativeTime ts={f.timestamp} />
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {liveLayers.quakes &&
        quakes.map((q) => (
          <Circle
            key={`qlayer-${q.id}`}
            center={[q.lat, q.lng]}
            radius={Math.max(
              25000,
              12000 * (q.severity === "critical" ? 5 : q.severity === "high" ? 3.5 : 2)
            )}
            pathOptions={{
              color: "#ff3355",
              fillColor: "#ff3355",
              fillOpacity: 0.1,
              weight: 1.5,
              opacity: 0.7,
            }}
          />
        ))}

      {liveLayers.planes &&
        planes.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={getPlaneIcon(p.heading, p.onGround, p.id === selectedAircraftId)}
            zIndexOffset={p.id === selectedAircraftId ? 900 : 650}
            eventHandlers={{ click: () => selectAircraft(p.id) }}
          >
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 170 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0891b2", letterSpacing: "0.12em" }}>
                  AIRCRAFT
                </div>
                <div style={{ fontWeight: 700, marginTop: 3 }}>{p.callsign}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                  {p.id.toUpperCase()} · {p.originCountry || "Origin unknown"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {p.altitudeFt != null ? `${p.altitudeFt.toLocaleString()} ft` : "alt —"}
                  {p.velocityKts != null ? ` · ${p.velocityKts} kts` : ""}
                  {p.heading != null ? ` · hdg ${Math.round(p.heading)}°` : ""}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>OpenSky Network</div>
              </div>
            </Popup>
          </Marker>
        ))}

      {liveLayers.planes && selectedAircraft && selectedTrail.length > 1 && (
        <Polyline
          positions={selectedTrail.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{ color: "#fbbf24", weight: 3, opacity: 0.9, dashArray: "8 7" }}
        />
      )}

      {liveLayers.planes && selectedAircraft && (
        <Circle
          center={[selectedAircraft.lat, selectedAircraft.lng]}
          radius={25_000}
          pathOptions={{
            color: "#fbbf24",
            fillColor: "#fbbf24",
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: "4 5",
          }}
        />
      )}

      {liveLayers.planes && ghostCourse && (
        <Polyline
          positions={ghostCourse}
          pathOptions={{ color: "#67e8f9", weight: 2, opacity: 0.55, dashArray: "2 10" }}
        />
      )}

      {liveLayers.planes && selectedAircraft && selectedThreat && (
        <Polyline
          positions={[
            [selectedAircraft.lat, selectedAircraft.lng],
            [selectedThreat.event.lat, selectedThreat.event.lng],
          ]}
          pathOptions={{
            color: selectedThreat.distanceKm < 120 ? "#ef4444" : "#f97316",
            weight: 2,
            opacity: 0.75,
            dashArray: "5 8",
          }}
        />
      )}

      {liveLayers.space && space?.auroraLikely && (
        <>
          <Circle
            center={[72, 0]}
            radius={2_200_000}
            pathOptions={{
              color: "#a855f7",
              fillColor: "#a855f7",
              fillOpacity: 0.07,
              weight: 1,
              dashArray: "4 8",
            }}
          />
          <Circle
            center={[-72, 0]}
            radius={2_200_000}
            pathOptions={{
              color: "#a855f7",
              fillColor: "#a855f7",
              fillOpacity: 0.07,
              weight: 1,
              dashArray: "4 8",
            }}
          />
        </>
      )}
    </>
  );
}
