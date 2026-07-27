"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { RegionalEvent } from "@/lib/data";
import { EVENT_COLORS, EVENT_EMOJI, severityColor } from "@/lib/data";
import { useSWStore } from "@/store/sw-store";
import ClimateCanvasLayer from "./ClimateCanvasLayer";
import RelativeTime from "@/components/ui/RelativeTime";

function severityRadius(s: RegionalEvent["severity"]) {
  if (s === "critical") return 14;
  if (s === "high") return 11;
  if (s === "medium") return 8;
  return 6;
}

function crisisHaloMeters(s: RegionalEvent["severity"]) {
  if (s === "critical") return 45000;
  if (s === "high") return 28000;
  if (s === "medium") return 16000;
  return 9000;
}

const cityIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:linear-gradient(135deg,#ef4444,#f97316);
    border:2.5px solid #fff;
    box-shadow:0 0 0 6px rgba(239,68,68,0.25),0 0 18px rgba(239,68,68,0.55);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const cameraIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:18px;height:18px;border-radius:4px;
    background:rgba(251,191,36,0.95);
    border:2px solid #fff;
    box-shadow:0 0 10px rgba(251,191,36,0.6);
    display:flex;align-items:center;justify-content:center;
    font-size:10px;line-height:1;
  ">📷</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const WORLD_BOUNDS: L.LatLngBoundsExpression = [[-85, -180], [85, 180]];
const RADAR_BOUNDS: L.LatLngBoundsExpression = [[-85, -180], [85, 180]];
const MAX_ZOOM = 18;
const FALLBACK_CENTER: L.LatLngExpression = [20, 0];
const FALLBACK_ZOOM = 2;

function setupPane(map: L.Map, name: string, zIndex: number) {
  const pane = map.getPane(name) ?? map.createPane(name);
  pane.style.zIndex = String(zIndex);
  return pane;
}

function MapWorldSetup() {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    const bounds = L.latLngBounds(WORLD_BOUNDS);
    map.setMaxBounds(bounds);
    map.options.maxBoundsViscosity = 1;

    setupPane(map, "radarPane", 340);
    const climatePane = setupPane(map, "climatePane", 360);
    climatePane.style.pointerEvents = "none";

    const syncFillZoom = (initial = false) => {
      map.invalidateSize();
      const { x, y } = map.getSize();
      if (x < 120 || y < 120) return false;

      const fillZoom = map.getBoundsZoom(bounds, true);
      if (!Number.isFinite(fillZoom)) return false;

      const minZoom = Math.max(1, fillZoom);
      map.setMinZoom(minZoom);

      if (initial && !initialized.current) {
        initialized.current = true;
        map.fitBounds(bounds, { animate: false, padding: [0, 0] });
      }

      if (map.getZoom() < minZoom) {
        map.setZoom(minZoom);
      }
      return true;
    };

    const boot = () => {
      if (!syncFillZoom(true)) {
        map.setView(FALLBACK_CENTER, FALLBACK_ZOOM, { animate: false });
      }
    };

    boot();
    const raf = requestAnimationFrame(boot);
    const delayed = window.setTimeout(boot, 200);
    const delayed2 = window.setTimeout(boot, 600);

    const onResize = () => syncFillZoom(false);
    map.on("resize", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(delayed);
      window.clearTimeout(delayed2);
      map.off("resize", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function MapController() {
  const map = useMap();
  const mapCenter = useSWStore((s) => s.mapCenter);
  const mapZoom = useSWStore((s) => s.mapZoom);
  const flyId = useSWStore((s) => s.flyId);
  const fitRegionId = useSWStore((s) => s.fitRegionId);
  const focus = useSWStore((s) => s.focus);
  const events = useSWStore((s) => s.events);
  const prevFly = useRef(0);
  const prevFit = useRef(0);

  useEffect(() => {
    if (flyId === 0 || flyId === prevFly.current) return;
    prevFly.current = flyId;
    map.flyTo(mapCenter, mapZoom, { duration: 1.2 });
  }, [flyId, mapCenter, mapZoom, map]);

  useEffect(() => {
    if (fitRegionId === 0 || fitRegionId === prevFit.current) return;
    prevFit.current = fitRegionId;
    if (!focus) return;

    const nearby = events.filter((e) => e.distanceKm <= 500).slice(0, 24);
    const points: L.LatLngExpression[] = [
      [focus.lat, focus.lng],
      ...nearby.map((e) => [e.lat, e.lng] as [number, number]),
    ];

    if (points.length === 1) {
      map.flyTo([focus.lat, focus.lng], 11, { duration: 1.1 });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.flyToBounds(bounds.pad(0.35), {
      duration: 1.2,
      maxZoom: 11,
      paddingTopLeft: [340, 70],
      paddingBottomRight: [120, 140],
    });
  }, [fitRegionId, focus, events, map]);

  return null;
}

function MapClickHazards() {
  const overlay = useSWStore((s) => s.overlay);
  const setHazardLoading = useSWStore((s) => s.setHazardLoading);
  const setHazard = useSWStore((s) => s.setHazard);
  const setPanel = useSWStore((s) => s.setPanel);

  useMapEvents({
    click: async (e) => {
      if (overlay === "temp" || overlay === "wind") return;
      // Ignore if user clicked a marker (Leaflet stops propagation on markers usually,
      // but we still debounce hazard load)
      const { lat, lng } = e.latlng;
      setHazardLoading(true);
      setPanel("events");
      try {
        const res = await fetch(`/api/hazards?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (!res.ok) {
          setHazard(null);
          return;
        }
        setHazard(data);
      } catch {
        setHazard(null);
      }
    },
  });

  return null;
}

export default function CrisisMap() {
  const events = useSWStore((s) => s.events);
  const cameras = useSWStore((s) => s.cameras);
  const focus = useSWStore((s) => s.focus);
  const selectedEvent = useSWStore((s) => s.selectedEvent);
  const setSelectedEvent = useSWStore((s) => s.setSelectedEvent);
  const setActiveCamera = useSWStore((s) => s.setActiveCamera);
  const setPanel = useSWStore((s) => s.setPanel);
  const overlay = useSWStore((s) => s.overlay);
  const radarPath = useSWStore((s) => s.radarPath);

  const selectedId = selectedEvent?.id;

  const radarUrl = useMemo(() => {
    if (!radarPath) return null;
    return `https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`;
  }, [radarPath]);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={1}
      maxZoom={MAX_ZOOM}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      worldCopyJump={false}
      style={{ height: "100%", width: "100%", background: "#0a0e14" }}
      zoomControl={true}
      attributionControl={true}
      scrollWheelZoom={true}
      touchZoom={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
        noWrap={true}
        className="sw-base-tile"
      />

      {overlay === "precip" && radarUrl && (
        <TileLayer
          url={radarUrl}
          bounds={RADAR_BOUNDS}
          pane="radarPane"
          opacity={0.7}
          zIndex={340}
          attribution="RainViewer"
          noWrap={true}
        />
      )}

      <MapWorldSetup />
      <MapController />
      <ClimateCanvasLayer />
      <MapClickHazards />

      {/* Crisis area halos — overlap zones matching severity */}
      {events.map((ev) => (
        <Circle
          key={`halo-${ev.id}`}
          center={[ev.lat, ev.lng]}
          radius={crisisHaloMeters(ev.severity)}
          pathOptions={{
            color: severityColor(ev.severity),
            fillColor: EVENT_COLORS[ev.kind],
            fillOpacity: selectedId === ev.id ? 0.22 : 0.1,
            weight: selectedId === ev.id ? 2 : 1,
            opacity: selectedId === ev.id ? 0.85 : 0.35,
          }}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              setSelectedEvent(ev);
              setPanel("events");
            },
          }}
        />
      ))}

      {/* Event markers */}
      {events.map((ev) => (
        <CircleMarker
          key={ev.id}
          center={[ev.lat, ev.lng]}
          radius={selectedId === ev.id ? severityRadius(ev.severity) + 4 : severityRadius(ev.severity)}
          pathOptions={{
            color: selectedId === ev.id ? "#fff" : severityColor(ev.severity),
            fillColor: EVENT_COLORS[ev.kind],
            fillOpacity: 0.9,
            weight: selectedId === ev.id ? 3 : 1.5,
            opacity: 1,
          }}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              setSelectedEvent(ev);
              setPanel("events");
            },
          }}
        >
          <Popup>
            <div style={{ minWidth: 200, fontFamily: "system-ui" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{EVENT_EMOJI[ev.kind]}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: severityColor(ev.severity),
                    textTransform: "uppercase",
                  }}
                >
                  {ev.severity}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                {ev.title}
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginBottom: 6 }}>
                {ev.detail}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {ev.source} · <RelativeTime ts={ev.timestamp} /> · {ev.distanceKm.toFixed(0)} km
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Regional camera pins */}
      {cameras.map((cam) => (
        <Marker
          key={cam.id}
          position={[cam.lat, cam.lng]}
          icon={cameraIcon}
          zIndexOffset={800}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              setActiveCamera(cam);
              setPanel("feeds");
            },
          }}
        >
          <Popup>
            <div style={{ fontFamily: "system-ui", fontSize: 13, minWidth: 180 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{cam.name}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {cam.source.toUpperCase()} · {cam.exact ? "exact" : "approx"} · {cam.distanceKm} km
              </div>
              <button
                type="button"
                onClick={() => setActiveCamera(cam)}
                style={{
                  marginTop: 8, fontSize: 11, padding: "4px 10px", cursor: "pointer",
                  background: "#fbbf24", border: "none", borderRadius: 4, color: "#0f172a", fontWeight: 600,
                }}
              >
                WATCH
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Searched city pin — close-up landmark */}
      {focus && (
        <Marker position={[focus.lat, focus.lng]} icon={cityIcon} zIndexOffset={1000}>
          <Popup>
            <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
              <strong>{focus.name}</strong>
              {focus.country ? `, ${focus.country}` : ""}
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                {focus.lat.toFixed(4)}°, {focus.lng.toFixed(4)}°
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
