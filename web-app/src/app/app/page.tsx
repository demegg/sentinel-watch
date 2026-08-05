"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSWStore } from "@/store/sw-store";
import { useAuthStore } from "@/store/auth-store";
import { hasEnteredAppThisSession } from "@/lib/app-session";
import { CITIES, type RegionalEvent } from "@/lib/data";
import { loadRegionalFeeds } from "@/lib/load-feeds";
import Sidebar from "@/components/hud/Sidebar";
import TopBar from "@/components/hud/TopBar";
import OverlayControls from "@/components/hud/OverlayControls";
import ViewModeControls from "@/components/hud/ViewModeControls";
import MiniRadar from "@/components/hud/MiniRadar";
import HazardPopup from "@/components/hud/HazardPopup";
import AlertsWatcher from "@/components/hud/AlertsWatcher";
import CommandTerminal from "@/components/terminal/CommandTerminal";
import { CameraViewer, RadioPlayer } from "@/components/feeds/LocalFeeds";

const MapLoader = dynamic(() => import("@/components/map/MapLoader"), { ssr: false });
const GoogleEarthView = dynamic(() => import("@/components/earth/GoogleEarthView"), { ssr: false });

function mergeEvents(primary: RegionalEvent[], secondary: RegionalEvent[], cap = 120) {
  const seen = new Set<string>();
  const out: RegionalEvent[] = [];
  for (const e of [...primary, ...secondary]) {
    const key = e.id || `${e.kind}-${e.title}-${e.lat.toFixed(2)}-${e.lng.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= cap) break;
  }
  return out;
}

function sourceLabelsFromPayload(data: {
  sources?: Record<string, number>;
}): string[] {
  const map: Record<string, string> = {
    usgs: "USGS",
    eonet: "NASA EONET",
    gdacs: "GDACS",
    conflicts: "Wikidata",
    outages: "Open-Meteo",
  };
  const labels: string[] = [];
  for (const [key, label] of Object.entries(map)) {
    if ((data.sources?.[key] ?? 0) > 0) labels.push(label);
  }
  return labels;
}

async function loadGlobalEvents() {
  const { setEventsLoading, setEvents, setMapScope } = useSWStore.getState();
  setEventsLoading(true);
  try {
    const res = await fetch("/api/events?lat=20&lng=0&global=1");
    const data = await res.json();
    setEvents(data.events ?? [], {
      fetchedAt: data.fetchedAt,
      sources: sourceLabelsFromPayload(data),
    });
    setMapScope("global");
  } catch {
    setEvents([]);
  }
}

async function refreshOverlays() {
  const { overlay, setRadarPath } = useSWStore.getState();
  if (overlay === "precip") {
    try {
      const res = await fetch("/api/radar");
      const data = await res.json();
      setRadarPath(data.path ?? null);
    } catch {
      setRadarPath(null);
    }
  }
}

async function loadPlace(q: string) {
  const {
    setEventsLoading,
    setEvents,
    setFocus,
    setMapView,
    pushTerminal,
    setSelectedEvent,
    setHazard,
    requestFitRegion,
    setMapScope,
    events: existing,
  } = useSWStore.getState();

  const lower = q.toLowerCase().trim();
  let place = CITIES.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.id === lower ||
      c.name.toLowerCase().startsWith(lower)
  );

  if (!place) {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&count=1`);
      const data = await res.json();
      if (data.place) {
        place = {
          id: data.place.id,
          name: data.place.name,
          country: data.place.country ?? "",
          countryCode: data.place.countryCode,
          lat: data.place.lat,
          lng: data.place.lng,
          type: "search",
          timezone: data.place.timezone,
        };
      }
    } catch {
      /* ignore */
    }
  }

  if (!place) {
    pushTerminal({ type: "out", text: `Place not found: ${q}` });
    return;
  }

  setHazard(null);
  setSelectedEvent(null);
  setFocus(place);
  setMapScope("regional");
  setMapView([place.lat, place.lng], 10);
  pushTerminal({ type: "in", text: `goto ${q}` });
  pushTerminal({ type: "out", text: `Navigating to ${place.name}…` });

  setEventsLoading(true);

  const evRes = await fetch(
    `/api/events?lat=${place.lat}&lng=${place.lng}&radius=3000`
  ).catch(() => null);
  const evData = evRes?.ok ? await evRes.json() : null;
  const regional: RegionalEvent[] = evData?.events ?? [];
  // Keep worldwide crises while adding regional ones so zoom-out still shows the map populated
  setEvents(mergeEvents(regional, existing), {
    fetchedAt: evData?.fetchedAt ?? Date.now(),
    sources: sourceLabelsFromPayload(evData ?? {}),
  });

  const feedsPromise = loadRegionalFeeds(place);
  requestFitRegion();
  void refreshOverlays();

  const feeds = await feedsPromise;

  pushTerminal({
    type: "out",
    text: `${place.name}: ${regional.length} nearby · ${useSWStore.getState().events.length} on map · ${feeds.cameras} cams · ${feeds.radios} radio`,
  });
}

async function resetWorldMap() {
  const {
    setFocus,
    setMapView,
    setSelectedEvent,
    setHazard,
    setActiveCamera,
    setPanel,
    pushTerminal,
    setMapScope,
  } = useSWStore.getState();

  setFocus(null);
  setSelectedEvent(null);
  setHazard(null);
  setActiveCamera(null);
  setMapScope("global");
  setMapView([20, 0], 2);
  setPanel("events");
  pushTerminal({ type: "out", text: "Reset to world map." });
  await loadGlobalEvents();
}

export default function AppView() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const hazard = useSWStore((s) => s.hazard);
  const hazardLoading = useSWStore((s) => s.hazardLoading);
  const viewMode = useSWStore((s) => s.viewMode);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const authUser = useAuthStore((s) => s.user);
  const places = useAuthStore((s) => s.places);
  const setPanel = useSWStore((s) => s.setPanel);
  const setMapView = useSWStore((s) => s.setMapView);
  const setFocus = useSWStore((s) => s.setFocus);
  const setMapScope = useSWStore((s) => s.setMapScope);
  const personalBooted = useRef(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (!hasEnteredAppThisSession()) {
      router.replace("/");
      return;
    }
    setSessionReady(true);
    void loadGlobalEvents();
  }, [router]);

  // Personal open once: places panel + soft first saved place.
  useEffect(() => {
    if (!sessionReady || personalBooted.current) return;
    if (!useAuthStore.getState().hydrated) return;
    personalBooted.current = true;
    if (!authUser) {
      setPanel("events");
      return;
    }
    setPanel("places");
    if (places[0]) {
      const p = places[0];
      setFocus({
        id: p.id,
        name: p.name,
        country: p.country,
        countryCode: p.countryCode,
        lat: p.lat,
        lng: p.lng,
        type: "user",
      });
      setMapScope("regional");
      setMapView([p.lat, p.lng], 5);
    }
  }, [
    sessionReady,
    authUser,
    places,
    setPanel,
    setFocus,
    setMapScope,
    setMapView,
  ]);

  const handleSearch = useCallback((q: string) => {
    void loadPlace(q);
  }, []);

  const handleResetWorld = useCallback(() => {
    void resetWorldMap();
  }, []);

  if (!sessionReady) return null;

  return (
    <div
      className="sw-app-shell sw-app-enter"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", overflow: "hidden" }}
    >
      {viewMode === "map" && <MapLoader />}
      {viewMode === "earth" && <GoogleEarthView />}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <TopBar onSearch={handleSearch} onResetWorld={handleResetWorld} />
        <Sidebar />
        <ViewModeControls />
        {viewMode === "map" && <OverlayControls />}
        {viewMode === "map" && <MiniRadar />}
        <HazardPopup />

        {!hazard && !hazardLoading && (
          <div className="sw-terminal-dock">
            <CommandTerminal />
          </div>
        )}
      </div>

      <CameraViewer />
      <RadioPlayer />
      <AlertsWatcher />
    </div>
  );
}
