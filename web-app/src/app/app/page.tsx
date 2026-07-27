"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSWStore } from "@/store/sw-store";
import { hasEnteredAppThisSession } from "@/lib/app-session";
import { CITIES } from "@/lib/data";
import { loadRegionalFeeds } from "@/lib/load-feeds";
import Sidebar from "@/components/hud/Sidebar";
import TopBar from "@/components/hud/TopBar";
import OverlayControls from "@/components/hud/OverlayControls";
import ViewModeControls from "@/components/hud/ViewModeControls";
import HazardPopup from "@/components/hud/HazardPopup";
import CommandTerminal from "@/components/terminal/CommandTerminal";
import { CameraViewer, RadioPlayer } from "@/components/feeds/LocalFeeds";

const MapLoader = dynamic(() => import("@/components/map/MapLoader"), { ssr: false });
const GoogleEarthView = dynamic(() => import("@/components/earth/GoogleEarthView"), { ssr: false });

async function loadGlobalEvents() {
  const { setEventsLoading, setEvents } = useSWStore.getState();
  setEventsLoading(true);
  try {
    const res = await fetch("/api/events?lat=20&lng=0&radius=20000");
    const data = await res.json();
    setEvents(data.events ?? []);
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
  // Climate/wind refresh handled by map bounds loader
}

async function loadPlace(q: string) {
  const {
    setEventsLoading,
    setEvents,
    setFocus,
    setMapView,
    pushTerminal,
    setPanel,
    setSelectedEvent,
    setHazard,
    requestFitRegion,
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
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
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
  // City-focused, but not so tight that regional crises vanish
  setMapView([place.lat, place.lng], 10);
  pushTerminal({ type: "in", text: `goto ${q}` });
  pushTerminal({ type: "out", text: `Navigating to ${place.name}…` });

  setEventsLoading(true);

  const evRes = await fetch(`/api/events?lat=${place.lat}&lng=${place.lng}&radius=1500`).catch(() => null);
  const evData = evRes?.ok ? await evRes.json() : null;
  setEvents(evData?.events ?? []);

  // Load regional cameras/radio in background (can take a few seconds)
  const feedsPromise = loadRegionalFeeds(place);

  // Fit city pin + nearby crisis markers into view (keeps "stuff around" visible)
  requestFitRegion();
  void refreshOverlays();

  const feeds = await feedsPromise;

  pushTerminal({
    type: "out",
    text: `${place.name}: ${evData?.events?.length ?? 0} regional events · ${feeds.cameras} cams · ${feeds.radios} radio`,
  });
}

export default function AppView() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const hazard = useSWStore((s) => s.hazard);
  const hazardLoading = useSWStore((s) => s.hazardLoading);
  const viewMode = useSWStore((s) => s.viewMode);

  useEffect(() => {
    if (!hasEnteredAppThisSession()) {
      router.replace("/");
      return;
    }
    setSessionReady(true);
    void loadGlobalEvents();
  }, [router]);

  const handleSearch = useCallback((q: string) => {
    void loadPlace(q);
  }, []);

  if (!sessionReady) return null;

  return (
    <div className="sw-app-shell sw-app-enter" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", overflow: "hidden" }}>
      {viewMode === "map" && <MapLoader />}
      {viewMode === "earth" && <GoogleEarthView />}

      {/* Glass HUD overlays on top of map */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <TopBar onSearch={handleSearch} />
        <Sidebar />
        <ViewModeControls />
        {viewMode === "map" && <OverlayControls />}
        <HazardPopup />

        {!hazard && !hazardLoading && (
          <div className="sw-terminal-dock">
            <CommandTerminal />
          </div>
        )}
      </div>

      <CameraViewer />
      <RadioPlayer />
    </div>
  );
}
