"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CITIES } from "@/lib/data";
import type { LocationPin } from "@/lib/data";
import { loadRegionalFeeds } from "@/lib/load-feeds";
import { useSWStore } from "@/store/sw-store";
import LoadingState from "@/components/ui/LoadingState";

async function typeOut(
  text: string,
  push: (l: { type: "in" | "out"; text: string }) => void,
  onChunk: (s: string) => void
) {
  let acc = "";
  for (const ch of text) {
    acc += ch;
    onChunk(acc);
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 9));
  }
  push({ type: "out", text });
}

function matchCity(q: string) {
  const lower = q.toLowerCase().trim();
  return CITIES.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.id === lower ||
      c.name.toLowerCase().startsWith(lower)
  );
}

async function resolvePlace(q: string): Promise<LocationPin | { error: string }> {
  const city = matchCity(q);
  if (city) return city;
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  if (!res.ok || data.error || !data.place) return { error: data.error ?? `Not found: ${q}` };
  const p = data.place;
  return { id: String(p.id), name: p.name, country: p.country ?? "", countryCode: p.countryCode, lat: p.lat, lng: p.lng, type: "search", timezone: p.timezone };
}

async function loadIntel(lat: number, lng: number, name: string, countryCode?: string, country?: string) {
  const { setEventsLoading, setEvents } = useSWStore.getState();
  setEventsLoading(true);
  const evRes = await fetch(`/api/events?lat=${lat}&lng=${lng}&radius=1500`).catch(() => null);
  const evData = evRes?.ok ? await evRes.json() : null;
  setEvents(evData?.events ?? []);

  const place: LocationPin = {
    id: "terminal-place",
    name,
    country: country ?? "",
    countryCode,
    lat,
    lng,
    type: "search",
  };
  const feeds = await loadRegionalFeeds(place);

  return {
    events: evData?.events?.length ?? 0,
    cameras: feeds.cameras,
    radios: feeds.radios,
  };
}

export default function CommandTerminal() {
  const history = useSWStore((s) => s.terminalHistory);
  const push = useSWStore((s) => s.pushTerminal);
  const clear = useSWStore((s) => s.clearTerminal);
  const setFocus = useSWStore((s) => s.setFocus);
  const setMapView = useSWStore((s) => s.setMapView);
  const setPanel = useSWStore((s) => s.setPanel);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, typing]);

  const gotoPlace = async (q: string): Promise<string> => {
    const place = await resolvePlace(q);
    if ("error" in place) return place.error;
    setFocus(place);
    setMapView([place.lat, place.lng], 10);
    const { events, cameras, radios } = await loadIntel(place.lat, place.lng, place.name, place.countryCode, place.country);
    if (cameras > 0) setPanel("feeds");
    else setPanel("events");
    useSWStore.getState().requestFitRegion();
    return `Waypoint locked: ${place.name}${place.country ? ", " + place.country : ""} · ${place.lat.toFixed(4)}°, ${place.lng.toFixed(4)}° · ${events} events · ${cameras} cams · ${radios} radio`;
  };

  const resolve = async (raw: string): Promise<string> => {
    const cmd = raw.trim().toLowerCase();
    const [base, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ").trim();

    switch (base) {
      case "help":
        return [
          "Commands (live data):",
          "  goto <place>    — fly to place, load events + feeds",
          "  find <place>    — same as goto",
          "  weather <place> — current conditions",
          "  time <place>    — local time",
          "  events          — show loaded events",
          "  cams / radio    — open feeds panel",
          "  earth           — 3D Google Earth view",
          "  map             — Sentinel Watch map view",
          "  clear           — clear terminal",
        ].join("\n");

      case "goto":
      case "find":
      case "go":
      case "locate":
      case "place":
        if (!arg) return "Usage: goto <place>  e.g. goto Kyiv";
        return gotoPlace(arg);

      case "weather": {
        if (!arg) return "Usage: weather <place>";
        const place = await resolvePlace(arg);
        if ("error" in place) return place.error;
        setFocus(place);
        setMapView([place.lat, place.lng], 10);
        const r = await fetch(`/api/weather?lat=${place.lat}&lng=${place.lng}&city=${encodeURIComponent(place.name)}`);
        const d = await r.json();
        if (!r.ok) return `Weather failed for ${place.name}: ${d.error ?? r.status}`;
        const c = d.current;
        return `${place.name}: ${c.temperature_2m}°C · ${c.condition} · humidity ${c.relative_humidity_2m}% · wind ${c.wind_speed_10m} km/h`;
      }

      case "time": {
        if (!arg) return `UTC ${new Date().toISOString()}`;
        const place = await resolvePlace(arg);
        if ("error" in place) return place.error;
        setFocus(place);
        if (!place.timezone) return `${place.name}: timezone unknown`;
        return `${place.name}: ${new Date().toLocaleString("en-GB", { timeZone: place.timezone })} (${place.timezone})`;
      }

      case "events": {
        const evs = useSWStore.getState().events;
        if (!evs.length) return "No events loaded. Try: goto <place>";
        return evs
          .slice(0, 8)
          .map((e) => `${e.kind.toUpperCase()} · ${e.title} · ${e.severity}`)
          .join("\n");
      }

      case "cams":
      case "cameras":
        setPanel("feeds");
        return `Opening feeds panel · ${useSWStore.getState().cameras.length} cameras`;

      case "radio":
        setPanel("feeds");
        return `Opening feeds panel · ${useSWStore.getState().radios.length} radio stations`;

      case "earth":
        useSWStore.getState().setViewMode("earth");
        return "Switched to 3D Google Earth view";

      case "map":
      case "crisis":
      case "sentinel":
        useSWStore.getState().setViewMode("map");
        return "Switched to Sentinel Watch map view";

      case "clear":
        return "__CLEAR__";

      default:
        return `Unknown command "${raw}". Type help.`;
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const cmd = input.trim();
    setInput("");
    push({ type: "in", text: cmd });
    setBusy(true);

    const result = await resolve(cmd);
    if (result === "__CLEAR__") { clear(); setBusy(false); return; }

    setTyping("");
    await typeOut(result, push, setTyping);
    setTyping("");
    setBusy(false);
  };

  return (
    <div
      style={{
        background: "rgba(10,14,20,0.92)",
        border: "1px solid rgba(34,211,238,0.2)",
        borderRadius: 6,
        padding: "10px 12px",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.35em", color: "#22d3ee", fontWeight: 600 }}>
          TERMINAL
        </span>
        <span style={{ fontSize: 9, color: "rgba(34,211,238,0.4)", letterSpacing: "0.2em" }}>LIVE</span>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 140,
          overflowY: "auto",
          fontSize: 11,
          lineHeight: 1.6,
          color: "rgba(226,232,240,0.8)",
          fontFamily: "'Courier New', monospace",
        }}
      >
        {busy && !typing && (
          <LoadingState compact label="Processing command…" sublabel="Fetching live data" />
        )}
        {history.map((line, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            <span style={{ color: line.type === "in" ? "#a78bfa" : "#22d3ee" }}>
              {line.type === "in" ? "› " : "◈ "}
            </span>
            {line.text}
          </div>
        ))}
        {typing && (
          <div style={{ whiteSpace: "pre-wrap", color: "#e2e8f0" }}>
            <span style={{ color: "#22d3ee" }}>◈ </span>
            {typing}
            <span className="blink" style={{ display: "inline-block", width: 6, height: 12, background: "#22d3ee", marginLeft: 2, verticalAlign: "middle" }} />
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderTop: "1px solid rgba(34,211,238,0.12)",
          paddingTop: 6,
        }}
      >
        <span style={{ color: "#22d3ee", fontSize: 12, fontFamily: "monospace" }}>›</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="goto Tokyo · weather Nairobi · find iss…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e2e8f0",
            fontSize: 12,
            fontFamily: "'Courier New', monospace",
          }}
          spellCheck={false}
          autoComplete="off"
        />
        <span className="blink" style={{ display: "inline-block", width: 5, height: 12, background: "#22d3ee" }} />
      </form>
    </div>
  );
}
