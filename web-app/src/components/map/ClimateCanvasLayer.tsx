"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useSWStore } from "@/store/sw-store";
import {
  type ClimatePoint,
  tempColor,
  windColor,
  windDirLabel,
  climateZone,
  hexToRgba,
} from "@/lib/climate-utils";

function gridDimensions(map: L.Map) {
  const { x, y } = map.getSize();
  const aspect = x / Math.max(y, 1);
  const rows = 9;
  const cols = Math.min(13, Math.max(6, Math.round(rows * aspect)));
  return { cols, rows };
}

function cellRadiusPx(map: L.Map, points: ClimatePoint[]) {
  if (points.length < 2) return 72;
  const a = map.latLngToContainerPoint([points[0].lat, points[0].lng]);
  const b = map.latLngToContainerPoint([points[1].lat, points[1].lng]);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(48, Math.min(160, d * 1.1));
}

function nearestPoint(
  map: L.Map,
  points: ClimatePoint[],
  x: number,
  y: number,
  maxDist: number
) {
  let best: ClimatePoint | null = null;
  let bestD = maxDist;
  for (const p of points) {
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export default function ClimateCanvasLayer() {
  const map = useMap();
  const router = useRouter();
  const overlay = useSWStore((s) => s.overlay);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef<ClimatePoint[]>([]);
  const hoverRef = useRef<ClimatePoint | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const active = overlay === "temp" || overlay === "wind";

  const [, setHoverTick] = useState(0);

  useEffect(() => {
    if (!active) {
      pointsRef.current = [];
      hoverRef.current = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
      map.getContainer().style.cursor = "";
      return;
    }

    const pane = map.getPane("climatePane") ?? map.createPane("climatePane");
    pane.style.zIndex = "360";

    const canvas = L.DomUtil.create("canvas", "sw-climate-canvas", pane) as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "auto";
    canvasRef.current = canvas;

    const tooltip = L.DomUtil.create("div", "sw-climate-tooltip", pane) as HTMLDivElement;
    tooltipRef.current = tooltip;

    const draw = () => {
      const pts = pointsRef.current;
      if (!canvasRef.current || !active) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const size = map.getSize();
      canvasRef.current.width = size.x;
      canvasRef.current.height = size.y;
      canvasRef.current.style.width = `${size.x}px`;
      canvasRef.current.style.height = `${size.y}px`;

      ctx.clearRect(0, 0, size.x, size.y);

      if (!pts.length) return;

      const radius = cellRadiusPx(map, pts);
      const mode = overlay;

      for (const p of pts) {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        if (pt.x < -radius || pt.y < -radius || pt.x > size.x + radius || pt.y > size.y + radius) {
          continue;
        }

        const color = mode === "temp" ? tempColor(p.temp) : windColor(p.wind);
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        grad.addColorStop(0, hexToRgba(color, 0.62));
        grad.addColorStop(0.45, hexToRgba(color, 0.38));
        grad.addColorStop(0.75, hexToRgba(color, 0.12));
        grad.addColorStop(1, hexToRgba(color, 0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const hover = hoverRef.current;
      if (hover && tooltipRef.current) {
        const hpt = map.latLngToContainerPoint([hover.lat, hover.lng]);
        const accent = mode === "temp" ? tempColor(hover.temp) : windColor(hover.wind);
        const tip = tooltipRef.current;
        tip.style.display = "block";
        tip.style.left = `${Math.min(size.x - 200, hpt.x + 14)}px`;
        tip.style.top = `${Math.max(8, hpt.y - 12)}px`;
        tip.style.borderColor = `${accent}66`;
        tip.replaceChildren();

        const title = document.createElement("div");
        title.className = "sw-ct-title";
        title.textContent = mode === "temp" ? "Climate zone" : "Wind zone";
        tip.appendChild(title);

        const value = document.createElement("div");
        value.className = "sw-ct-value";
        value.style.color = accent;
        value.textContent =
          mode === "temp"
            ? `${hover.temp.toFixed(1)}°C`
            : `${hover.wind.toFixed(1)} km/h`;
        tip.appendChild(value);

        if (mode === "temp") {
          const condition = document.createElement("div");
          condition.className = "sw-ct-sub";
          condition.textContent = String(hover.condition ?? "");
          tip.appendChild(condition);
          const zone = document.createElement("div");
          zone.className = "sw-ct-sub";
          zone.textContent = climateZone(hover.temp);
          tip.appendChild(zone);
        } else {
          const wind = document.createElement("div");
          wind.className = "sw-ct-sub";
          wind.textContent = `${windDirLabel(hover.windDir)} (${hover.windDir.toFixed(0)}°)`;
          tip.appendChild(wind);
        }

        const hint = document.createElement("div");
        hint.className = "sw-ct-hint";
        hint.textContent = "Click for full regional brief";
        tip.appendChild(hint);
      } else if (tooltipRef.current) {
        tooltipRef.current.style.display = "none";
      }
    };

    const fetchPoints = () => {
      const bounds = map.getBounds();
      const { cols, rows } = gridDimensions(map);
      const id = ++reqId.current;

      const qs = new URLSearchParams({
        minLat: String(bounds.getSouth()),
        maxLat: String(bounds.getNorth()),
        minLng: String(bounds.getWest()),
        maxLng: String(bounds.getEast()),
        cols: String(cols),
        rows: String(rows),
      });

      fetch(`/api/climate?${qs}`)
        .then((r) => r.json())
        .then((data) => {
          if (id !== reqId.current) return;
          pointsRef.current = (data.points ?? []) as ClimatePoint[];
          draw();
        })
        .catch(() => {
          if (id !== reqId.current) return;
        });
    };

    const scheduleFetch = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(fetchPoints, 450);
    };

    const onMove = () => draw();
    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const radius = cellRadiusPx(map, pointsRef.current);
      const hit = nearestPoint(map, pointsRef.current, x, y, radius * 0.55);
      const changed = hit?.lat !== hoverRef.current?.lat || hit?.lng !== hoverRef.current?.lng;
      hoverRef.current = hit;
      map.getContainer().style.cursor = hit ? "pointer" : "";
      if (changed) {
        setHoverTick((n) => n + 1);
        draw();
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const radius = cellRadiusPx(map, pointsRef.current);
      const hit = nearestPoint(map, pointsRef.current, x, y, radius * 0.55);
      if (!hit) return;
      L.DomEvent.stopPropagation(e);
      router.push(`/region?lat=${hit.lat.toFixed(4)}&lng=${hit.lng.toFixed(4)}`);
    };

    const onLeave = () => {
      hoverRef.current = null;
      map.getContainer().style.cursor = "";
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
      draw();
    };

    fetchPoints();
    map.on("move", onMove);
    map.on("zoom", onMove);
    map.on("resize", draw);
    map.on("moveend", scheduleFetch);
    map.on("zoomend", scheduleFetch);
    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      map.off("move", onMove);
      map.off("zoom", onMove);
      map.off("resize", draw);
      map.off("moveend", scheduleFetch);
      map.off("zoomend", scheduleFetch);
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
      L.DomUtil.remove(canvas);
      L.DomUtil.remove(tooltip);
      canvasRef.current = null;
      tooltipRef.current = null;
      map.getContainer().style.cursor = "";
    };
  }, [map, overlay, active, router]);

  return null;
}
