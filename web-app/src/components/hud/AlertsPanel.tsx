"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  MapPin,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useAlertsStore } from "@/store/alerts-store";
import { useSWStore } from "@/store/sw-store";
import RelativeTime from "@/components/ui/RelativeTime";
import type { AlertMinSeverity } from "@/lib/alerts-storage";

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#facc15",
  low: "#4ade80",
};

export default function AlertsPanel() {
  const user = useAuthStore((s) => s.user);
  const places = useAuthStore((s) => s.places);
  const hydrate = useAlertsStore((s) => s.hydrate);
  const syncRulesFromPlaces = useAlertsStore((s) => s.syncRulesFromPlaces);
  const rules = useAlertsStore((s) => s.rules);
  const inbox = useAlertsStore((s) => s.inbox);
  const prefs = useAlertsStore((s) => s.prefs);
  const checking = useAlertsStore((s) => s.checking);
  const lastCheckAt = useAlertsStore((s) => s.lastCheckAt);
  const setRuleEnabled = useAlertsStore((s) => s.setRuleEnabled);
  const setRuleSeverity = useAlertsStore((s) => s.setRuleSeverity);
  const setRuleRadius = useAlertsStore((s) => s.setRuleRadius);
  const setPrefs = useAlertsStore((s) => s.setPrefs);
  const markRead = useAlertsStore((s) => s.markRead);
  const markAllRead = useAlertsStore((s) => s.markAllRead);
  const clearInbox = useAlertsStore((s) => s.clearInbox);
  const runCheck = useAlertsStore((s) => s.runCheck);
  const setMapView = useSWStore((s) => s.setMapView);
  const setSelectedEvent = useSWStore((s) => s.setSelectedEvent);
  const setPanel = useSWStore((s) => s.setPanel);

  useEffect(() => {
    hydrate(user?.email ?? null);
  }, [user?.email, hydrate]);

  useEffect(() => {
    if (user?.email && places.length) syncRulesFromPlaces(places);
  }, [user?.email, places, syncRulesFromPlaces]);

  const enablePush = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setPrefs({ browserPush: perm === "granted" });
  };

  if (!user) {
    return (
      <div className="sw-places-panel">
        <p className="sw-places-muted">
          Sign in and save places to get alerts when crises hit near you.
        </p>
        <Link href="/auth?mode=signup" className="sw-places-cta">
          Sign up free
        </Link>
      </div>
    );
  }

  if (!places.length) {
    return (
      <div className="sw-places-panel">
        <p className="sw-places-muted">Add at least one saved place to arm alerts.</p>
        <Link href="/onboarding?edit=1" className="sw-places-cta">
          Add places
        </Link>
      </div>
    );
  }

  return (
    <div className="sw-alerts-panel">
      <div className="sw-alerts-toolbar">
        <button
          type="button"
          className="sw-places-refresh"
          disabled={checking}
          onClick={() => void runCheck()}
          title="Check now"
        >
          <RefreshCw size={13} className={checking ? "sw-spin" : undefined} />
        </button>
        <button type="button" className="sw-alerts-mini" onClick={markAllRead}>
          <CheckCheck size={12} /> Mark read
        </button>
        <button type="button" className="sw-alerts-mini is-danger" onClick={clearInbox}>
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div className="sw-alerts-prefs">
        <button
          type="button"
          className={`sw-alerts-push${prefs.browserPush ? " is-on" : ""}`}
          onClick={() => {
            if (!prefs.browserPush) void enablePush();
            else setPrefs({ browserPush: false });
          }}
        >
          {prefs.browserPush ? <BellRing size={13} /> : <BellOff size={13} />}
          {prefs.browserPush ? "Browser alerts on" : "Enable browser alerts"}
        </button>
        {lastCheckAt && (
          <span className="sw-places-muted">
            Last check <RelativeTime ts={lastCheckAt} />
          </span>
        )}
      </div>

      <div className="sw-alerts-section-title">Watch rules</div>
      <div className="sw-alerts-rules">
        {rules.map((r) => (
          <div key={r.id} className="sw-alerts-rule">
            <div className="sw-alerts-rule-head">
              <MapPin size={12} />
              <strong>{r.placeName}</strong>
              <button
                type="button"
                className={`sw-alerts-toggle${r.enabled ? " is-on" : ""}`}
                onClick={() => setRuleEnabled(r.id, !r.enabled)}
                aria-pressed={r.enabled}
              >
                {r.enabled ? <Bell size={12} /> : <BellOff size={12} />}
              </button>
            </div>
            <div className="sw-alerts-rule-controls">
              <label>
                Min
                <select
                  value={r.minSeverity}
                  onChange={(e) =>
                    setRuleSeverity(r.id, e.target.value as AlertMinSeverity)
                  }
                >
                  <option value="medium">Medium+</option>
                  <option value="high">High+</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                Radius
                <select
                  value={r.radiusKm}
                  onChange={(e) => setRuleRadius(r.id, Number(e.target.value))}
                >
                  <option value={100}>100 km</option>
                  <option value={250}>250 km</option>
                  <option value={500}>500 km</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="sw-alerts-section-title">
        Inbox {inbox.filter((a) => !a.read).length ? `(${inbox.filter((a) => !a.read).length} new)` : ""}
      </div>

      {!inbox.length && (
        <p className="sw-places-muted">No alerts yet. Rules are armed — check now or wait for the next poll.</p>
      )}

      <div className="sw-alerts-inbox">
        {inbox.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`sw-alerts-item${a.read ? "" : " is-unread"}`}
            onClick={() => {
              markRead(a.id);
              setSelectedEvent({
                id: a.eventId,
                kind: (a.kind as "earthquake" | "wildfire" | "storm" | "flood" | "conflict" | "disaster" | "other") || "other",
                title: a.title,
                detail: a.detail,
                lat: a.lat,
                lng: a.lng,
                distanceKm: a.distanceKm,
                severity: (["low", "medium", "high", "critical"].includes(a.severity)
                  ? a.severity
                  : "medium") as "low" | "medium" | "high" | "critical",
                timestamp: a.createdAt,
                source: a.source,
              });
              setMapView([a.lat, a.lng], 8);
              setPanel("events");
            }}
          >
            <div className="sw-alerts-item-top">
              <span style={{ color: SEV_COLOR[a.severity] ?? "#94a3b8" }}>
                {a.severity.toUpperCase()}
              </span>
              <span>{a.placeName}</span>
              <RelativeTime ts={a.createdAt} />
            </div>
            <div className="sw-alerts-item-title">{a.title}</div>
            <div className="sw-alerts-item-meta">
              {a.kind} · {a.distanceKm.toFixed(0)} km · {a.source}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
