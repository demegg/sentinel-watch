"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useSWStore } from "@/store/sw-store";
import type { SavedPlace } from "@/lib/auth-storage";
import type { RegionalEvent } from "@/lib/data";
import { severityColor } from "@/lib/data";
import RelativeTime from "@/components/ui/RelativeTime";
import LoadingState from "@/components/ui/LoadingState";

type PlaceStatus = "clear" | "watch" | "alert";

type PlaceSnapshot = {
  place: SavedPlace;
  status: PlaceStatus;
  label: string;
  topEvent: RegionalEvent | null;
  eventCount: number;
  fetchedAt: number;
};

function rankStatus(events: RegionalEvent[]): {
  status: PlaceStatus;
  label: string;
  topEvent: RegionalEvent | null;
} {
  if (!events.length) {
    return { status: "clear", label: "All clear nearby", topEvent: null };
  }
  const critical = events.find((e) => e.severity === "critical");
  const high = events.find((e) => e.severity === "high");
  if (critical) {
    return { status: "alert", label: critical.title, topEvent: critical };
  }
  if (high) {
    return { status: "watch", label: high.title, topEvent: high };
  }
  return {
    status: "watch",
    label: events[0].title,
    topEvent: events[0],
  };
}

const STATUS_COLOR: Record<PlaceStatus, string> = {
  clear: "#4ade80",
  watch: "#facc15",
  alert: "#ef4444",
};

export default function PlacesPanel() {
  const user = useAuthStore((s) => s.user);
  const places = useAuthStore((s) => s.places);
  const removePlace = useAuthStore((s) => s.removePlace);
  const signOut = useAuthStore((s) => s.signOut);
  const setMapView = useSWStore((s) => s.setMapView);
  const setFocus = useSWStore((s) => s.setFocus);
  const setSelectedEvent = useSWStore((s) => s.setSelectedEvent);
  const requestFitRegion = useSWStore((s) => s.requestFitRegion);
  const setMapScope = useSWStore((s) => s.setMapScope);
  const setPanel = useSWStore((s) => s.setPanel);

  const [snapshots, setSnapshots] = useState<PlaceSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!places.length) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await Promise.all(
        places.map(async (place) => {
          try {
            const res = await fetch(
              `/api/events?lat=${place.lat}&lng=${place.lng}&radius=250`
            );
            const data = await res.json();
            const events: RegionalEvent[] = data.events ?? [];
            const ranked = rankStatus(events);
            return {
              place,
              ...ranked,
              eventCount: events.length,
              fetchedAt: data.fetchedAt ?? Date.now(),
            } satisfies PlaceSnapshot;
          } catch {
            return {
              place,
              status: "watch" as const,
              label: "Status unavailable",
              topEvent: null,
              eventCount: 0,
              fetchedAt: Date.now(),
            };
          }
        })
      );
      setSnapshots(rows);
    } catch {
      setError("Could not refresh place status.");
    } finally {
      setLoading(false);
    }
  }, [places]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goToPlace = (place: SavedPlace, ev?: RegionalEvent | null) => {
    setFocus({
      id: place.id,
      name: place.name,
      country: place.country,
      countryCode: place.countryCode,
      lat: place.lat,
      lng: place.lng,
      type: "user",
    });
    setMapScope("regional");
    if (ev) {
      setSelectedEvent(ev);
      setMapView([ev.lat, ev.lng], 10);
    } else {
      setSelectedEvent(null);
      setMapView([place.lat, place.lng], 9);
      requestFitRegion();
    }
  };

  if (!user) {
    return (
      <div className="sw-places-panel">
        <p className="sw-places-muted">
          Sign in to save places, manage alerts, and open the map personal to you.
        </p>
        <Link href="/auth?mode=signup" className="sw-places-cta">
          Sign up free
        </Link>
        <Link href="/auth" className="sw-places-link">
          Already have an account? Sign in
        </Link>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="sw-places-panel">
      <div className="sw-profile-account">
        <div className="sw-profile-account-row">
          <div className="sw-profile-avatar" aria-hidden>
            {initials || "SW"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sw-places-hello">{user.name}</div>
            <div className="sw-profile-email">{user.email}</div>
          </div>
        </div>
        <div className="sw-profile-actions">
          <button
            type="button"
            className="sw-profile-action"
            onClick={() => setPanel("alerts")}
          >
            <Bell size={12} /> Alerts
          </button>
          <Link href="/onboarding?edit=1" className="sw-profile-action">
            <Plus size={12} /> Edit places
          </Link>
          <button
            type="button"
            className="sw-profile-action is-danger"
            onClick={() => {
              signOut();
              setPanel("events");
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>

      <div className="sw-places-header">
        <div>
          <div className="sw-profile-section-label">My places</div>
          <div className="sw-places-muted">Live status within 250 km</div>
        </div>
        <button
          type="button"
          className="sw-places-refresh"
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "sw-spin" : undefined} />
        </button>
      </div>

      {loading && !snapshots.length && (
        <LoadingState
          compact
          label="Checking your places…"
          sublabel="Scanning nearby crises within 250 km"
        />
      )}

      {error && <div className="sw-auth-error">{error}</div>}

      {!places.length && !loading && (
        <div className="sw-places-empty">
          <ShieldCheck size={18} />
          <p>No saved places yet. Add cities you care about so the map opens personal.</p>
          <Link href="/onboarding?edit=1" className="sw-places-cta">
            <Plus size={14} /> Add places
          </Link>
        </div>
      )}

      <div className="sw-places-list">
        {snapshots.map((row) => (
          <div key={row.place.id} className="sw-places-card">
            <button
              type="button"
              className="sw-places-card-main"
              onClick={() => goToPlace(row.place, row.topEvent)}
            >
              <div
                className="sw-places-status-dot"
                style={{ background: STATUS_COLOR[row.status] }}
              />
              <div className="sw-places-card-body">
                <div className="sw-places-name">
                  <MapPin size={12} />
                  {row.place.name}
                  {row.place.country ? (
                    <span>, {row.place.country}</span>
                  ) : null}
                </div>
                <div
                  className="sw-places-status-label"
                  style={{ color: STATUS_COLOR[row.status] }}
                >
                  {row.status === "alert" && <AlertTriangle size={11} />}
                  {row.status.toUpperCase()} · {row.label}
                </div>
                <div className="sw-places-meta">
                  {row.eventCount} nearby · updated <RelativeTime ts={row.fetchedAt} />
                </div>
              </div>
            </button>
            <div className="sw-places-card-actions">
              <Link
                href={`/region?lat=${row.place.lat}&lng=${row.place.lng}`}
                className="sw-places-mini"
                title="Full region report"
              >
                Report
              </Link>
              {row.topEvent && (
                <span
                  className="sw-places-sev"
                  style={{ color: severityColor(row.topEvent.severity) }}
                >
                  {row.topEvent.severity}
                </span>
              )}
              <button
                type="button"
                className="sw-places-mini is-danger"
                title="Remove place"
                onClick={() => removePlace(row.place.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {places.length > 0 && places.length < 8 && (
        <Link href="/onboarding?edit=1" className="sw-places-link">
          <Plus size={12} /> Add another place
        </Link>
      )}
    </div>
  );
}
