"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSWStore } from "@/store/sw-store";
import type { RegionalEvent } from "@/lib/data";
import { EVENT_EMOJI, EVENT_COLORS, severityColor } from "@/lib/data";
import { safeHttpUrl } from "@/lib/security";
import RelativeTime from "@/components/ui/RelativeTime";
import LoadingState from "@/components/ui/LoadingState";

const SEVERITY_ORDER: RegionalEvent["severity"][] = [
  "critical",
  "high",
  "medium",
  "low",
];

function EventRow({
  ev,
  selected,
  onSelect,
}: {
  ev: RegionalEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 10px",
        background: selected ? "rgba(239,68,68,0.08)" : "transparent",
        border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: EVENT_COLORS[ev.kind],
          flexShrink: 0,
          marginTop: 4,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: "#e2e8f0",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {ev.title}
        </div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
          {ev.source} · <RelativeTime ts={ev.timestamp} />
          {ev.distanceKm < 9000 ? ` · ${ev.distanceKm.toFixed(0)} km` : ""}
        </div>
      </div>
    </button>
  );
}

function SeverityDropdown({
  severity,
  events,
  open,
  onToggle,
  selectedId,
  onSelect,
}: {
  severity: RegionalEvent["severity"];
  events: RegionalEvent[];
  open: boolean;
  onToggle: () => void;
  selectedId?: string;
  onSelect: (ev: RegionalEvent) => void;
}) {
  if (!events.length) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6,
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: open ? "rgba(255,255,255,0.03)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <ChevronDown
          size={14}
          style={{
            color: severityColor(severity),
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: severityColor(severity),
          }}
        >
          {severity}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "#64748b",
            background: "rgba(255,255,255,0.05)",
            padding: "2px 7px",
            borderRadius: 99,
          }}
        >
          {events.length}
        </span>
      </button>

      {open && (
        <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              ev={ev}
              selected={selectedId === ev.id}
              onSelect={() => onSelect(ev)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsPanel() {
  const events = useSWStore((s) => s.events);
  const eventsLoading = useSWStore((s) => s.eventsLoading);
  const selectedEvent = useSWStore((s) => s.selectedEvent);
  const setSelectedEvent = useSWStore((s) => s.setSelectedEvent);
  const setMapView = useSWStore((s) => s.setMapView);

  const grouped = useMemo(() => {
    const map: Record<RegionalEvent["severity"], RegionalEvent[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const ev of events) map[ev.severity].push(ev);
    return map;
  }, [events]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  const toggle = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const anyOpen = SEVERITY_ORDER.some((s) => openSections[s]);
  const expandAll = () =>
    setOpenSections({ critical: true, high: true, medium: true, low: true });
  const collapseAll = () =>
    setOpenSections({ critical: false, high: false, medium: false, low: false });

  if (eventsLoading) {
    return (
      <LoadingState
        compact
        label="Loading crisis events…"
        sublabel="Scanning earthquakes, wildfires, storms & conflicts"
      />
    );
  }

  if (!events.length) {
    return (
      <div style={{ textAlign: "center", padding: "32px 12px", color: "#475569", fontSize: 12, lineHeight: 1.6 }}>
        No events loaded.{"\n"}Search a city or use: goto {"<"}place{">"}
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Selected event detail — stays pinned at top */}
      {selectedEvent && (
        <div
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "#ef4444" }}>SELECTED</span>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
            {EVENT_EMOJI[selectedEvent.kind]} {selectedEvent.title}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>{selectedEvent.detail}</div>
          {selectedEvent.url && safeHttpUrl(selectedEvent.url) && (
            <a
              href={safeHttpUrl(selectedEvent.url)!}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#22d3ee" }}
            >
              View source ↗
            </a>
          )}
        </div>
      )}

      {/* List header + expand/collapse */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "#64748b" }}>
          {events.length} EVENTS
        </span>
        <button
          type="button"
          onClick={anyOpen ? collapseAll : expandAll}
          style={{
            fontSize: 10,
            color: "#22d3ee",
            background: "transparent",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          {anyOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Collapsible severity groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SEVERITY_ORDER.map((severity) => (
          <SeverityDropdown
            key={severity}
            severity={severity}
            events={grouped[severity]}
            open={!!openSections[severity]}
            onToggle={() => toggle(severity)}
            selectedId={selectedEvent?.id}
            onSelect={(ev) => {
              setSelectedEvent(ev);
              setMapView([ev.lat, ev.lng], 12);
            }}
          />
        ))}
      </div>
    </div>
  );
}
