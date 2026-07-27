"use client";

import { useEffect, useRef } from "react";

/**
 * SentinelWatch surveillance globe.
 * Pure-canvas dotted Earth — no 3D deps. Recognisable continents built from
 * coarse lat/lng regions, faint meridian wireframe, a rotating radar sweep, and
 * pulsing "detection" blips at real monitored cities. Matches the app's
 * radar-sweep logo and #ef4444 / #f97316 / #22d3ee palette.
 */

type P = { x: number; y: number; z: number; land: boolean };

// Coarse continent boxes: [latMin, latMax, lngMin, lngMax]
const LAND: [number, number, number, number][] = [
  // North America
  [48, 71, -141, -60], [30, 49, -125, -70], [15, 30, -110, -86],
  [58, 72, -168, -140], [60, 83, -55, -20], // Alaska + Greenland
  // South America
  [2, 12, -80, -60], [-12, 3, -78, -46], [-24, -12, -72, -40],
  [-40, -24, -73, -54], [-55, -40, -74, -65],
  // Europe
  [40, 60, -10, 30], [55, 71, 5, 42], [36, 46, -9, 28],
  // Africa
  [16, 34, -16, 34], [2, 18, -17, 42], [-12, 4, 9, 42], [-35, -12, 12, 40],
  // Asia
  [43, 72, 32, 180], [30, 55, 45, 130], [20, 40, 55, 122],
  [6, 30, 68, 96], [0, 22, 96, 128], [30, 46, 126, 146],
  // Australia + NZ
  [-38, -12, 113, 154], [-47, -34, 166, 179],
];

function isLand(lat: number, lng: number): boolean {
  for (const [a, b, c, d] of LAND) {
    if (lat >= a && lat <= b && lng >= c && lng <= d) return true;
  }
  return false;
}

// Monitored hotspots (real city coords from the app's dataset)
const HOTSPOTS: [number, number][] = [
  [40.71, -74.01], [51.51, -0.13], [35.68, 139.65], [50.45, 30.52],
  [1.35, 103.82], [-33.87, 151.21], [30.04, 31.24], [55.76, 37.62],
  [41.72, 44.83], [19.08, 72.88], [-22.91, -43.17],
];

function toXYZ(latDeg: number, lngDeg: number): P {
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  return {
    x: Math.cos(lat) * Math.cos(lng),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.sin(lng),
    land: isLand(latDeg, lngDeg),
  };
}

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ tx: 0, ty: 0, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- build point cloud ---
    const points: P[] = [];
    // Fibonacci sphere for even coverage
    const N = 2600;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lng = (Math.atan2(z, x) * 180) / Math.PI;
      const land = isLand(lat, lng);
      // keep all land points, thin out ocean for a cleaner sphere
      if (land || i % 3 === 0) points.push({ x, y, z, land });
    }

    // meridians + parallels wireframe
    const wire: P[] = [];
    for (let lng = -180; lng < 180; lng += 30) {
      for (let lat = -80; lat <= 80; lat += 4) wire.push(toXYZ(lat, lng));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lng = -180; lng < 180; lng += 4) wire.push(toXYZ(lat, lng));
    }

    const hot = HOTSPOTS.map(([la, ln]) => toXYZ(la, ln));

    let raf = 0;
    let dpr = 1;
    let cx = 0, cy = 0, R = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      cx = canvas.width / 2;
      cy = canvas.height / 2;
      R = Math.min(cx, cy) * 0.9;
    }
    resize();
    window.addEventListener("resize", resize);

    const TILT = -0.35; // fixed axial tilt (radians)
    const start = performance.now();

    function rot(p: P, ay: number, ax: number) {
      // rotate around Y (spin) then X (tilt + parallax)
      const x = p.x * Math.cos(ay) - p.z * Math.sin(ay);
      const z = p.x * Math.sin(ay) + p.z * Math.cos(ay);
      const y = p.y;
      const y2 = y * Math.cos(ax) - z * Math.sin(ax);
      const z2 = y * Math.sin(ax) + z * Math.cos(ax);
      return { x, y: y2, z: z2, land: p.land };
    }

    function frame(now: number) {
      if (!ctx || !canvas) return;
      const t = (now - start) / 1000;
      // ease mouse parallax
      mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.05;
      mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.05;

      const spin = reduce ? 0.6 : t * 0.13 + mouse.current.x * 0.5;
      const ax = TILT + mouse.current.y * 0.35;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(34,211,238,0.10)");
      glow.addColorStop(0.5, "rgba(239,68,68,0.06)");
      glow.addColorStop(1, "rgba(10,14,20,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // dark globe body
      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      body.addColorStop(0, "rgba(17,24,39,0.95)");
      body.addColorStop(1, "rgba(10,14,20,0.98)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // rim light
      ctx.strokeStyle = "rgba(34,211,238,0.25)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // wireframe (behind + front, dim)
      ctx.fillStyle = "rgba(100,116,139,0.18)";
      for (const p of wire) {
        const r = rot(p, spin, ax);
        if (r.z < -0.1) continue;
        const s = 0.6 + (r.z + 1) * 0.35;
        ctx.globalAlpha = r.z < 0 ? 0.15 : 0.4;
        ctx.beginPath();
        ctx.arc(cx + r.x * R, cy - r.y * R, s * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // radar sweep longitude (front hemisphere brightening)
      const sweep = ((t * 0.6) % (Math.PI * 2)) - Math.PI;

      // land + ocean dots (front hemisphere only)
      for (const p of points) {
        const r = rot(p, spin, ax);
        if (r.z < 0) continue;
        const px = cx + r.x * R;
        const py = cy - r.y * R;
        const depth = r.z; // 0..1
        // proximity to sweep meridian for a glowing pass
        const ang = Math.atan2(r.z, r.x);
        let near = Math.abs(ang - sweep);
        if (near > Math.PI) near = Math.PI * 2 - near;
        const flare = Math.max(0, 1 - near / 0.35);

        if (p.land) {
          const base = 0.35 + depth * 0.5;
          ctx.globalAlpha = base;
          ctx.fillStyle = flare > 0
            ? `rgba(${Math.round(239 + flare * 16)},${Math.round(68 + flare * 80)},${Math.round(60 + flare * 20)},1)`
            : "rgba(239,68,68,0.9)";
          const sz = (0.9 + depth * 0.8 + flare * 0.9) * dpr;
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = (0.1 + depth * 0.18) * (1 + flare);
          ctx.fillStyle = flare > 0.2 ? "rgba(34,211,238,0.7)" : "rgba(71,85,105,0.6)";
          ctx.beginPath();
          ctx.arc(px, py, (0.5 + depth * 0.4) * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // pulsing detection blips at monitored cities
      for (let i = 0; i < hot.length; i++) {
        const r = rot(hot[i], spin, ax);
        if (r.z < 0.02) continue;
        const px = cx + r.x * R;
        const py = cy - r.y * R;
        const phase = (t * 0.9 + i * 0.6) % 1;
        const ringR = phase * 16 * dpr;
        ctx.globalAlpha = (1 - phase) * 0.7 * r.z;
        ctx.strokeStyle = "rgba(249,115,22,0.9)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.9 * r.z;
        ctx.fillStyle = "#f97316";
        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 8 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onMove(e: PointerEvent) {
      const w = window.innerWidth, h = window.innerHeight;
      mouse.current.tx = (e.clientX / w - 0.5) * 2;
      mouse.current.ty = (e.clientY / h - 0.5) * 2;
    }
    window.addEventListener("pointermove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
